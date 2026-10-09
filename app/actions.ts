"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { calculateBillTotal } from "@/lib/bill"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { connection } from 'next/server'
import bcrypt from "bcryptjs"
import { setSession, logout as clearSession, getSession } from "@/lib/auth"
import { getStartOfDayWIB, getEndOfDayWIB, getOperationalBusinessDate } from "@/lib/timezone"
import { summarizeShiftCash } from "@/lib/shift-cash"
import { cashSalesForBill } from "@/lib/shift-cash"
import { nextShiftExpenseTotal, normalizeShiftExpenseInput } from "@/lib/shift-expense"

// ─── Auth Helpers ───────────────────────────────────────────────────
const ROLE_ORDER = ["PELAYAN", "BARTENDER", "DAPUR", "KASIR", "MANAJER"] as const

type UserRole = (typeof ROLE_ORDER)[number]

async function requireSession() {
  const session = await getSession()
  if (!session) throw new Error("Anda harus login terlebih dahulu.")
  return session
}

async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireSession()
  const currentRole = session.user.peran as UserRole
  if (!allowedRoles.includes(currentRole)) {
    throw new Error(`Aksi ini hanya diperbolehkan untuk role: ${allowedRoles.join(", ")}.`)
  }
  return session
}

async function comparePinWithCandidates(pin: string, candidates: Array<string | null | undefined>) {
  const normalizedCandidates = [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate && candidate.trim())))]

  for (const candidate of normalizedCandidates) {
    try {
      if (candidate === pin) return true
      if (await bcrypt.compare(pin, candidate)) return true
    } catch {
      if (candidate === pin) return true
    }
  }

  return false
}

async function verifyManagerPin(pin: string) {
  const [managerUser, managerSetting] = await Promise.all([
    prisma.user.findFirst({ where: { peran: 'MANAJER', isDeleted: false } }),
    prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } })
  ])

  const pinValid = await comparePinWithCandidates(pin, [managerUser?.pin, managerSetting?.nilai])
  if (!pinValid) {
    throw new Error("PIN manajer salah.")
  }
}

async function requireManager(pin?: string) {
  const session = await requireSession()

  if (pin) {
    await verifyManagerPin(pin)
    return session
  }

  if (session.user.peran !== 'MANAJER') {
    throw new Error('Aksi ini hanya dapat dilakukan oleh manager atau dengan PIN manager yang valid.')
  }

  return session
}

async function requireMenuManager() {
  return requireRole(["MANAJER", "KASIR"])
}

function normalizeMenuPayload(nama: string, harga: number, kategori: "MAKANAN" | "MINUMAN") {
  const cleanedNama = nama.trim()
  if (!cleanedNama) throw new Error("Nama menu wajib diisi.")

  const parsedHarga = Number(harga)
  if (!Number.isFinite(parsedHarga) || parsedHarga < 0) {
    throw new Error("Harga menu harus berupa angka yang valid dan tidak negatif.")
  }

  if (!['MAKANAN', 'MINUMAN'].includes(kategori)) {
    throw new Error("Kategori menu tidak valid.")
  }

  return { cleanedNama, parsedHarga }
}
// ────────────────────────────────────────────────────────────────────

export async function createTakeAwayOrder() {
  const session = await getSession()
  if (!session) throw new Error("Anda harus login")

  const kasirId = session.user.id
  const shift = await prisma.shift.findFirst({ where: { kasirId, waktuTutup: null } })
  const shiftId = shift ? shift.id : null

  // Calculate nomorBill (increment for today)
  const todayStart = getStartOfDayWIB()
  const todayCount = await prisma.bill.count({ where: { waktuBuka: { gte: todayStart } } })
  const nomorBill = todayCount + 1

  const pajakSetting = await prisma.setting.findUnique({ where: { kunci: 'PAJAK' } })
  const serviceSetting = await prisma.setting.findUnique({ where: { kunci: 'SERVICE_CHARGE' } })
  const pajakPct = parseInt(pajakSetting?.nilai || '10')
  const servicePct = parseInt(serviceSetting?.nilai || '5')

  const bill = await prisma.bill.create({
    data: {
      businessDate: getOperationalBusinessDate(),
      tipe: "TAKE_AWAY",
      status: "TERBUKA",
      kasirId,
      shiftId,
      nomorBill,
      pajakPct,
      servicePct
    }
  })
  redirect(`/bill/${bill.id}`)
}

export async function updateItemStatus(itemId: string, status: "DIKIRIM" | "DIPROSES" | "SIAP") {
  await prisma.billItem.update({
    where: { id: itemId },
    data: { status }
  })
}

export async function getKitchenItems(kategori: "MAKANAN" | "MINUMAN") {
  return prisma.billItem.findMany({
    where: {
      status: { not: "SIAP" },
      menuItem: { kategori },
      isVoid: false,
      isComp: false,
      diretur: false,
    },
    orderBy: { bill: { waktuBuka: 'asc' } },
    include: { menuItem: true, bill: { include: { sofa: true } } }
  })
}


export async function createOrGetActiveBill(
  sofaId: string,
  sofaStatus: "KOSONG" | "TERISI" | "MENUNGGU_MAKANAN" | "SIAP_BAYAR"
) {
  const activeBill = await prisma.bill.findFirst({
    where: { sofaId, status: "TERBUKA" },
    include: { billItems: true }
  })

  if (activeBill) {
    if (sofaStatus === "KOSONG") {
      await prisma.sofa.update({
        where: { id: sofaId },
        data: { status: "TERISI" }
      })
    }
    return { bill: activeBill, sofaStatus: sofaStatus === "KOSONG" ? "TERISI" as const : sofaStatus }
  }

  const session = await getSession()
  const kasirId = session?.user?.id
  const [shift, pajakSetting, serviceSetting] = await Promise.all([
    kasirId
      ? prisma.shift.findFirst({ where: { kasirId, waktuTutup: null } })
      : Promise.resolve(null),
    prisma.setting.findUnique({ where: { kunci: 'PAJAK' } }),
    prisma.setting.findUnique({ where: { kunci: 'SERVICE_CHARGE' } }),
  ])

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const sofa = await tx.sofa.findUnique({ where: { id: sofaId } })
        if (!sofa || sofa.isDeleted) {
          throw new Error('Meja tidak ditemukan atau tidak aktif.')
        }

        let bill = await tx.bill.findFirst({
          where: { sofaId, status: "TERBUKA" },
          include: { billItems: true }
        })

        if (!bill) {
          const todayStart = getStartOfDayWIB()
          const todayCount = await tx.bill.count({ where: { waktuBuka: { gte: todayStart } } })
          const nomorBill = todayCount + 1
          const pajakPct = parseInt(pajakSetting?.nilai || '10')
          const servicePct = parseInt(serviceSetting?.nilai || '5')

          bill = await tx.bill.create({
            data: {
              businessDate: getOperationalBusinessDate(),
              sofaId,
              tipe: "DINE_IN",
              status: "TERBUKA",
              kasirId,
              shiftId: shift?.id,
              nomorBill,
              pajakPct,
              servicePct
            },
            include: { billItems: true }
          })
        }

        if (sofa.status !== 'TERISI' && sofa.status !== 'MENUNGGU_MAKANAN' && sofa.status !== 'SIAP_BAYAR') {
          await tx.sofa.update({
            where: { id: sofaId },
            data: { status: 'TERISI' }
          })
        }

        return {
          bill,
          sofaStatus: sofa.status === "KOSONG" ? "TERISI" as const : sofa.status
        }
      }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 10_000 })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
}

export async function cleanupEmptyBills() {
  await connection()
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000)
  
  const emptyBills = await prisma.bill.findMany({
    where: { 
      status: "TERBUKA",
      waktuBuka: { lt: tenMinsAgo },
      billItems: { none: {} } 
    }
  })

  for (const bill of emptyBills) {
    if (bill.sofaId) {
      // Periksa apakah ini satu-satunya bill terbuka di sofa ini
      const activeBillsCount = await prisma.bill.count({
        where: { sofaId: bill.sofaId, status: "TERBUKA" }
      })
      if (activeBillsCount <= 1) {
        await prisma.sofa.update({
          where: { id: bill.sofaId },
          data: { status: "KOSONG" }
        })
      }
    }
    await prisma.bill.delete({ where: { id: bill.id } })
  }
}

export async function addMenuItemToBill(billId: string, menuItemId: string, qty: number, catatan?: string) {
  const parsedQty = Number(qty)
  if (!Number.isFinite(parsedQty) || parsedQty <= 0 || !Number.isInteger(parsedQty)) {
    throw new Error("Jumlah item harus bilangan bulat dan lebih dari 0.")
  }

  const [menuItem, settings] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: menuItemId } }),
    prisma.setting.findMany({
      where: {
        kunci: {
          in: ['HAPPY_HOUR_AKTIF', 'HAPPY_HOUR_MULAI', 'HAPPY_HOUR_SELESAI', 'HAPPY_HOUR_DISKON']
        }
      },
      select: { kunci: true, nilai: true }
    })
  ])
  if (!menuItem) throw new Error("Menu item not found")
  if (!menuItem.tersedia) throw new Error("Menu item habis")

  // Check Happy Hour
  const settingsMap = new Map(settings.map(setting => [setting.kunci, setting.nilai]))
  const getSetting = (k: string, fb: string) => settingsMap.get(k) || fb
  const hhAktif = getSetting('HAPPY_HOUR_AKTIF', 'false') === 'true'
  const hhMulai = getSetting('HAPPY_HOUR_MULAI', '17:00')
  const hhSelesai = getSetting('HAPPY_HOUR_SELESAI', '20:00')
  const hhDiskon = parseInt(getSetting('HAPPY_HOUR_DISKON', '10')) || 0

  let hargaFinal = menuItem.harga
  let isHhApplied = false

  if (hhAktif && hhDiskon > 0) {
    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    if (currentTime >= hhMulai && currentTime <= hhSelesai) {
      hargaFinal = Math.max(0, menuItem.harga - (menuItem.harga * hhDiskon / 100))
      isHhApplied = true
    }
  }

  const item = await prisma.billItem.create({
    data: {
      billId,
      menuItemId,
      namaItem: isHhApplied ? `${menuItem.nama} (HH -${hhDiskon}%)` : menuItem.nama,
      harga: hargaFinal,
      qty: parsedQty,
      catatan,
      status: "DIKIRIM"
    }
  })

  const totals = await calculateBillTotal(billId)
  revalidatePath(`/`)
  return { item, totals }
}

export async function updateItemQty(itemId: string, delta: number) {
  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')
  if (item.isVoid || item.isComp || item.diretur) throw new Error('Item sudah tidak aktif')

  const newQty = item.qty + delta

  if (newQty <= 0) {
    // Hapus item jika qty jadi 0
    await prisma.billItem.delete({ where: { id: itemId } })
  } else {
    await prisma.billItem.update({ where: { id: itemId }, data: { qty: newQty } })
  }

  await calculateBillTotal(item.billId)
  revalidatePath('/')
}

export async function cancelLunasBill(billId: string, alasan: string, pin: string) {
  const session = await getSession()
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan pembatalan')
  await requireManager(pin)

  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) throw new Error('Bill not found')
  if (bill.status !== "LUNAS") throw new Error('Bill ini tidak berstatus LUNAS')

  await prisma.bill.update({
    where: { id: billId },
    data: { status: "BATAL" }
  })

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'KOREKSI_BATAL_BILL_LUNAS',
      entitas: 'Bill',
      detail: JSON.stringify({
        billId,
        nomorBill: bill.nomorBill,
        alasan: cleanedAlasan,
        otorisasi: session?.user?.nama || 'SYSTEM',
        total: bill.total
      })
    }
  })

  revalidatePath('/riwayat')
  revalidatePath('/summary')
}

export async function cancelBill(billId: string, alasan: string, pin: string) {
  const session = await getSession()
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan pembatalan')
  await requireManager(pin)

  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) throw new Error('Bill not found')

  await prisma.bill.update({
    where: { id: billId },
    data: {
      status: "BATAL",
      waktuTutup: new Date()
    }
  })

  if (bill.sofaId) {
    await prisma.sofa.update({
      where: { id: bill.sofaId },
      data: { status: "KOSONG" }
    })
    revalidatePath(`/sofa/${bill.sofaId}`)
  }

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'CANCEL_BILL',
      entitas: 'Bill',
      detail: JSON.stringify({
        billId,
        nomorBill: bill.nomorBill,
        alasan: cleanedAlasan,
        otorisasi: session?.user?.nama || 'SYSTEM',
        total: bill.total,
        sofaId: bill.sofaId
      })
    }
  })

  revalidatePath(`/`)
  revalidatePath(`/open-order`)
  revalidatePath(`/summary`)
  redirect("/")
}

function normalizePaymentMethod(metodeBayar?: string) {
  const raw = (metodeBayar ?? 'TUNAI').trim().toUpperCase()
  if (!raw) return 'TUNAI'
  if (raw.startsWith('SPLIT')) return 'SPLIT'
  return raw
}

function normalizeAuditReason(alasan: string, label: string) {
  const cleaned = alasan.trim()
  if (!cleaned) throw new Error(`${label} wajib diisi.`)
  if (cleaned.length < 3) throw new Error(`${label} minimal 3 karakter.`)
  return cleaned
}

export async function closeBill(billId: string, metodeBayar: string, uangDiterima?: number) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) throw new Error('Bill tidak ditemukan.')
  if (bill.status !== 'TERBUKA') throw new Error('Bill ini sudah ditutup atau dibatalkan.')

  const normalizedMethod = normalizePaymentMethod(metodeBayar)
  const validMethods = ['TUNAI', 'KARTU', 'QRIS', 'SPLIT']
  if (!validMethods.includes(normalizedMethod)) {
    throw new Error('Metode pembayaran tidak valid.')
  }

  const totalBill = Number(bill.total ?? 0)
  if (!Number.isFinite(totalBill) || totalBill < 0) {
    throw new Error('Total bill tidak valid untuk proses pembayaran.')
  }

  const nominalDiterima = Number(uangDiterima ?? totalBill)
  if (!Number.isFinite(nominalDiterima) || nominalDiterima < 0) {
    throw new Error('Nominal uang yang diterima tidak valid.')
  }

  if (normalizedMethod === 'TUNAI' && totalBill > 0 && nominalDiterima < totalBill) {
    throw new Error('Uang yang diterima kurang dari total tagihan.')
  }

  if (normalizedMethod !== 'TUNAI' && totalBill > 0 && nominalDiterima < totalBill) {
    throw new Error('Nominal pembayaran tidak boleh kurang dari total tagihan untuk metode non-tunai.')
  }

  const kembalian = Math.max(0, nominalDiterima - totalBill)

  // Simpan snapshot tarif saat bill ditutup
  const { getSettings } = await import('@/lib/bill')
  const settings = await getSettings()

  await prisma.$transaction(async (tx) => {
    const closedBill = await tx.bill.updateMany({
      where: { id: billId, status: "TERBUKA" },
      data: {
        status: "LUNAS",
        waktuTutup: new Date(),
        metodeBayar: normalizedMethod
      }
    })
    if (closedBill.count !== 1) {
      throw new Error('Bill ini sudah ditutup atau dibatalkan.')
    }

    if (bill.sofaId) {
      const remainingOpenBills = await tx.bill.count({
        where: { sofaId: bill.sofaId, status: "TERBUKA" }
      })
      if (remainingOpenBills === 0) {
        await tx.sofa.update({
          where: { id: bill.sofaId },
          data: { status: "KOSONG" }
        })
      }
    }

    await tx.auditLog.create({
      data: {
        userId: bill.kasirId || null,
        aksi: 'CLOSE_BILL',
        entitas: 'Bill',
        detail: JSON.stringify({
          billId,
          metodeBayar: normalizedMethod,
          total: totalBill,
          uangDiterima: nominalDiterima,
          kembalian,
          pajak: settings.pajak,
          serviceCharge: settings.serviceCharge
        })
      }
    })
  })

  revalidatePath(`/`)
  revalidatePath(`/open-order`)
  revalidatePath(`/summary`)
  revalidatePath(`/dine-in`)
  if (bill.sofaId) revalidatePath(`/sofa/${bill.sofaId}`)
}

export async function returnItem(itemId: string, alasan: string, pin?: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan retur')

  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')
  if (item.isVoid) throw new Error('Item ini sudah di-void, tidak dapat diretur.')
  if (item.isComp) throw new Error('Item ini sudah di-comp, tidak dapat diretur.')
  if (item.diretur) throw new Error('Item sudah diretur sebelumnya.')

  const bill = await prisma.bill.findUnique({ where: { id: item.billId } })
  if (!bill) throw new Error('Bill tidak ditemukan.')
  if (bill.status !== 'TERBUKA') throw new Error('Retur hanya dapat dilakukan pada bill yang masih terbuka.')

  await prisma.billItem.update({
    where: { id: itemId },
    data: {
      diretur: true,
      alasanVoidComp: cleanedAlasan,
      otorisasiOleh: session?.user?.nama || 'MANAJER'
    }
  })
  await calculateBillTotal(item.billId)

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'RETURN_ITEM',
      entitas: 'BillItem',
      detail: JSON.stringify({ itemId, billId: item.billId, namaItem: item.namaItem, alasan: cleanedAlasan, otorisasi: session?.user?.nama })
    }
  })
  revalidatePath(`/`)
  revalidatePath(`/summary`)
}

export async function voidItem(itemId: string, alasan: string, pin: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan void')

  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')
  if (item.isVoid) throw new Error('Item ini sudah di-void sebelumnya.')
  if (item.isComp) throw new Error('Item ini sudah di-comp, tidak dapat di-void.')
  if (item.diretur) throw new Error('Item yang sudah diretur tidak dapat diubah.')

  await prisma.billItem.update({
    where: { id: itemId },
    data: { isVoid: true, alasanVoidComp: cleanedAlasan, otorisasiOleh: session?.user?.nama || 'MANAJER' }
  })
  await calculateBillTotal(item.billId)

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'VOID_ITEM',
      entitas: 'BillItem',
      detail: JSON.stringify({ itemId, billId: item.billId, namaItem: item.namaItem, alasan: cleanedAlasan, otorisasi: session?.user?.nama })
    }
  })
  revalidatePath(`/`)
  revalidatePath(`/summary`)
}

export async function compItem(itemId: string, alasan: string, pin: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan comp')

  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')
  if (item.isVoid) throw new Error('Item ini sudah di-void, tidak dapat di-comp.')
  if (item.isComp) throw new Error('Item ini sudah di-comp sebelumnya.')
  if (item.diretur) throw new Error('Item yang sudah diretur tidak dapat diubah.')

  await prisma.billItem.update({
    where: { id: itemId },
    data: { isComp: true, alasanVoidComp: cleanedAlasan, otorisasiOleh: session?.user?.nama || 'MANAJER' }
  })
  await calculateBillTotal(item.billId)

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'COMP_ITEM',
      entitas: 'BillItem',
      detail: JSON.stringify({ itemId, billId: item.billId, namaItem: item.namaItem, alasan: cleanedAlasan, otorisasi: session?.user?.nama })
    }
  })
  revalidatePath(`/`)
  revalidatePath(`/summary`)
}

export async function toggleMenuAvailability(menuItemId: string) {
  const session = await requireMenuManager()

  const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, isDeleted: false } })
  if (!item) throw new Error('Menu not found')

  const nextAvailability = !item.tersedia

  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { tersedia: nextAvailability }
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      aksi: nextAvailability ? 'MENU_RESTOCK' : 'MENU_MARKED_HABIS',
      entitas: 'MenuItem',
      detail: JSON.stringify({
        menuItemId,
        nama: item.nama,
        kategori: item.kategori,
        tersedia: nextAvailability,
        otorisasi: session.user.nama
      })
    }
  })

  revalidatePath(`/menu`)
  revalidatePath(`/`)
}

export async function addMenuItem(nama: string, harga: number, kategori: "MAKANAN" | "MINUMAN") {
  const session = await requireMenuManager()

  const { cleanedNama, parsedHarga } = normalizeMenuPayload(nama, harga, kategori)
  const existing = await prisma.menuItem.findFirst({
    where: {
      nama: { equals: cleanedNama, mode: 'insensitive' },
      isDeleted: false,
    }
  })

  if (existing) {
    throw new Error(`Menu "${cleanedNama}" sudah ada.`)
  }

  const created = await prisma.menuItem.create({ data: { nama: cleanedNama, harga: parsedHarga, kategori } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      aksi: 'MENU_CREATED',
      entitas: 'MenuItem',
      detail: JSON.stringify({ menuItemId: created.id, nama: cleanedNama, harga: parsedHarga, kategori, otorisasi: session.user.nama })
    }
  })

  revalidatePath('/menu')
  revalidatePath('/')
}

export async function editMenuItem(id: string, nama: string, harga: number, kategori: "MAKANAN" | "MINUMAN") {
  const session = await requireMenuManager()

  const { cleanedNama, parsedHarga } = normalizeMenuPayload(nama, harga, kategori)
  const existing = await prisma.menuItem.findFirst({
    where: {
      nama: { equals: cleanedNama, mode: 'insensitive' },
      id: { not: id },
      isDeleted: false,
    }
  })

  if (existing) {
    throw new Error(`Menu "${cleanedNama}" sudah ada.`)
  }

  const current = await prisma.menuItem.findUnique({ where: { id } })
  if (!current) throw new Error('Menu tidak ditemukan.')

  await prisma.menuItem.update({ where: { id }, data: { nama: cleanedNama, harga: parsedHarga, kategori } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      aksi: 'MENU_UPDATED',
      entitas: 'MenuItem',
      detail: JSON.stringify({
        menuItemId: id,
        sebelumnya: { nama: current.nama, harga: current.harga, kategori: current.kategori },
        terbaru: { nama: cleanedNama, harga: parsedHarga, kategori },
        otorisasi: session.user.nama
      })
    }
  })

  revalidatePath('/menu')
  revalidatePath('/')
}

export async function deleteMenuItem(id: string) {
  const session = await requireMenuManager()

  const item = await prisma.menuItem.findFirst({ where: { id, isDeleted: false } })
  if (!item) throw new Error('Menu tidak ditemukan.')

  await prisma.menuItem.update({ where: { id, isDeleted: false }, data: { isDeleted: true, tersedia: false } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      aksi: 'MENU_DELETED',
      entitas: 'MenuItem',
      detail: JSON.stringify({ menuItemId: id, nama: item.nama, kategori: item.kategori, otorisasi: session.user.nama })
    }
  })

  revalidatePath('/menu')
  revalidatePath('/')
}

function normalizeSofaData(nama: string, kapasitas: number) {
  const cleanedNama = nama.trim()
  if (!cleanedNama) throw new Error('Nama meja / area wajib diisi.')

  const parsedKapasitas = Number(kapasitas)
  if (!Number.isFinite(parsedKapasitas) || parsedKapasitas <= 0 || !Number.isInteger(parsedKapasitas)) {
    throw new Error('Kapasitas meja harus bilangan bulat dan lebih dari 0.')
  }

  return { cleanedNama, parsedKapasitas }
}

export async function addSofa(nama: string, kapasitas: number) {
  const { cleanedNama, parsedKapasitas } = normalizeSofaData(nama, kapasitas)
  const existing = await prisma.sofa.findFirst({
    where: { nama: { equals: cleanedNama, mode: 'insensitive' }, isDeleted: false }
  })

  if (existing) throw new Error(`Meja "${cleanedNama}" sudah ada.`)

  await prisma.sofa.create({ data: { nama: cleanedNama, kapasitas: parsedKapasitas } })
  revalidatePath('/sofas')
  revalidatePath('/')
}

export async function editSofa(id: string, nama: string, kapasitas: number) {
  const { cleanedNama, parsedKapasitas } = normalizeSofaData(nama, kapasitas)
  const existing = await prisma.sofa.findFirst({
    where: { nama: { equals: cleanedNama, mode: 'insensitive' }, id: { not: id }, isDeleted: false }
  })

  if (existing) throw new Error(`Meja "${cleanedNama}" sudah ada.`)

  await prisma.sofa.update({ where: { id }, data: { nama: cleanedNama, kapasitas: parsedKapasitas } })
  revalidatePath('/sofas')
  revalidatePath('/')
}

export async function deleteSofa(id: string) {
  // Check if sofa has active/open bill
  const activeBill = await prisma.bill.findFirst({ where: { sofaId: id, status: 'TERBUKA' } })
  if (activeBill) throw new Error('Meja sedang digunakan dan memiliki tagihan aktif. Tutup tagihan terlebih dahulu.')
  await prisma.sofa.update({ where: { id }, data: { isDeleted: true } })
  revalidatePath('/sofas')
  revalidatePath('/')
}

export async function applyDiscount(billId: string, diskon: number) {
  if (diskon < 0) throw new Error('Diskon tidak boleh negatif')

  await prisma.bill.update({
    where: { id: billId },
    data: { diskon }
  })

  await calculateBillTotal(billId)

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: null,
      aksi: 'APPLY_DISCOUNT',
      entitas: 'Bill',
      detail: JSON.stringify({ billId, diskon })
    }
  })

  revalidatePath(`/`)
}

export async function pindahSofa(billId: string, sofaBaruId: string) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) throw new Error('Bill not found')
  if (!bill.sofaId) throw new Error('Bill ini tidak terkait sofa')

  const sofaLama = bill.sofaId

  // Reset sofa lama
  await prisma.sofa.update({
    where: { id: sofaLama },
    data: { status: 'KOSONG' }
  })

  // Set sofa baru
  await prisma.sofa.update({
    where: { id: sofaBaruId },
    data: { status: 'TERISI' }
  })

  // Update bill
  await prisma.bill.update({
    where: { id: billId },
    data: { sofaId: sofaBaruId }
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: null,
      aksi: 'PINDAH_SOFA',
      entitas: 'Bill',
      detail: JSON.stringify({ billId, dari: sofaLama, ke: sofaBaruId })
    }
  })

  revalidatePath(`/`)
  revalidatePath(`/sofa/${sofaLama}`)
  revalidatePath(`/sofa/${sofaBaruId}`)
}

export async function setSofaStatus(sofaId: string, status: "KOSONG" | "TERISI" | "MENUNGGU_MAKANAN" | "SIAP_BAYAR") {
  if (status === "KOSONG") {
    const activeBill = await prisma.bill.findFirst({
      where: { sofaId, status: "TERBUKA" },
      select: { id: true }
    })
    if (activeBill) {
      return {
        success: false as const,
        message: 'Meja masih memiliki bill terbuka. Selesaikan atau batalkan bill terlebih dahulu.'
      }
    }
  }

  await prisma.sofa.update({
    where: { id: sofaId },
    data: { status }
  })
  revalidatePath(`/`)
  revalidatePath(`/dine-in`)
  revalidatePath(`/sofa/${sofaId}`)
  return { success: true as const }
}

export async function openShift(kasirId: string, kasAwal: number) {
  const existing = await prisma.shift.findFirst({
    where: { kasirId, waktuTutup: null }
  })
  if (existing) throw new Error('Shift masih terbuka. Tutup shift dulu.')

  const shift = await prisma.shift.create({
    data: { kasirId, kasAwal }
  })

  revalidatePath(`/shift`)
  return shift
}

export async function closeShift(shiftId: string, kasHitung: number, pin?: string) {
  const session = await requireSession()
  await requireManager(pin)
  if (!Number.isSafeInteger(kasHitung) || kasHitung < 0) {
    throw new Error("Kas fisik harus berupa rupiah bulat dan tidak negatif.")
  }

  await prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } })
    if (!shift) throw new Error('Shift tidak ditemukan.')
    if (shift.waktuTutup) throw new Error('Shift ini sudah ditutup.')

    const openBills = await tx.bill.count({
      where: { shiftId, status: 'TERBUKA' }
    })
    if (openBills > 0) {
      throw new Error(`Tidak bisa tutup shift. Masih ada ${openBills} tagihan yang belum lunas/ditutup.`)
    }

    const bills = await tx.bill.findMany({
      where: {
        status: 'LUNAS',
        shiftId,
        waktuTutup: { gte: shift.waktuBuka }
      }
    })
    const totalPenjualan = bills.reduce((acc, bill) => acc + bill.total, 0)
    const penjualanTunai = bills.reduce((sum, bill) => sum + cashSalesForBill(bill), 0)
    const expectedCash = shift.kasAwal + penjualanTunai - shift.pengeluaran
    const selisih = kasHitung - expectedCash

    const updated = await tx.shift.updateMany({
      where: { id: shiftId, waktuTutup: null },
      data: {
        waktuTutup: new Date(),
        kasAkhir: kasHitung,
        kasHitung,
        selisih,
        totalPenjualan
      }
    })
    if (updated.count === 0) throw new Error('Shift sudah ditutup oleh proses lain.')

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'CLOSE_SHIFT',
        entitas: 'Shift',
        detail: JSON.stringify({
          shiftId,
          kasAwal: shift.kasAwal,
          totalPenjualan,
          penjualanTunai,
          pengeluaran: shift.pengeluaran,
          kasHitung,
          expectedCash,
          selisih,
          otorisasi: session.user.nama
        })
      }
    })
  }, { isolationLevel: "Serializable" })

  revalidatePath('/shift')
  revalidatePath('/summary')
  revalidatePath('/print/eod')
  revalidatePath('/eod-report')
}

export async function catatPengeluaran(shiftId: string, jumlah: number, catatan: string, pin?: string) {
  const session = await requireSession()
  if (typeof shiftId !== "string" || !shiftId.trim()) throw new Error("Shift tidak valid.")
  const expense = normalizeShiftExpenseInput(jumlah, catatan)
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) throw new Error("Shift tidak ditemukan.")
  if (shift.waktuTutup) throw new Error("Pengeluaran hanya dapat dicatat pada shift yang masih aktif.")

  const isOwner = session.user.id === shift.kasirId
  const isManager = session.user.peran === 'MANAJER'

  if (!isOwner && !isManager) {
    throw new Error('Hanya kasir pemilik shift atau manager yang dapat mencatat pengeluaran.')
  }

  if (pin !== undefined && pin !== "") {
    if (typeof pin !== "string") throw new Error("PIN manajer tidak valid.")
    await verifyManagerPin(pin)
  }

  await prisma.$transaction(async (tx) => {
    const currentShift = await tx.shift.findUnique({ where: { id: shiftId } })
    if (!currentShift) throw new Error("Shift tidak ditemukan.")
    if (currentShift.waktuTutup) throw new Error("Pengeluaran hanya dapat dicatat pada shift yang masih aktif.")
    if (session.user.id !== currentShift.kasirId && session.user.peran !== "MANAJER") {
      throw new Error("Hanya kasir pemilik shift atau manager yang dapat mencatat pengeluaran.")
    }

    const totalPengeluaran = nextShiftExpenseTotal(currentShift.pengeluaran, expense.jumlah)
    const updated = await tx.shift.updateMany({
      where: { id: shiftId, waktuTutup: null },
      data: {
        pengeluaran: totalPengeluaran,
        catatanPengeluaran: currentShift.catatanPengeluaran
          ? `${currentShift.catatanPengeluaran} | ${expense.catatan}`
          : expense.catatan
      }
    })
    if (updated.count === 0) throw new Error("Shift sudah ditutup. Pengeluaran tidak dicatat.")

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'EXPENSE_SHIFT',
        entitas: 'Shift',
        detail: JSON.stringify({
          shiftId,
          jumlah: expense.jumlah,
          catatan: expense.catatan,
          otorisasi: session.user.nama
        })
      }
    })
  }, { isolationLevel: "Serializable" })

  revalidatePath(`/shift`)
}

export async function createReservasi(sofaId: string, nama: string, jam: string, jumlahOrang: number, deposit?: number) {
  const cleanedNama = nama.trim()
  if (!sofaId) throw new Error('Pilih sofa terlebih dahulu.')
  if (!cleanedNama) throw new Error('Nama tamu harus diisi.')
  if (!Number.isFinite(jumlahOrang) || jumlahOrang <= 0) throw new Error('Jumlah orang harus lebih dari 0.')

  const sofa = await prisma.sofa.findUnique({ where: { id: sofaId } })
  if (!sofa || sofa.isDeleted) throw new Error('Sofa tidak ditemukan atau tidak aktif.')
  if (sofa.kapasitas < jumlahOrang) throw new Error(`Kapasitas sofa ${sofa.nama} hanya ${sofa.kapasitas} orang.`)

  const targetJam = new Date(jam)
  if (Number.isNaN(targetJam.getTime())) throw new Error('Waktu reservasi tidak valid.')

  const windowStart = new Date(targetJam.getTime() - 30 * 60 * 1000)
  const windowEnd = new Date(targetJam.getTime() + 2 * 60 * 60 * 1000)

  const conflict = await prisma.reservasi.count({
    where: {
      sofaId,
      status: { not: 'CANCELLED' },
      jam: {
        gte: windowStart,
        lte: windowEnd,
      },
    }
  })

  if (conflict > 0) {
    throw new Error('Sofa sudah memiliki reservasi pada rentang waktu yang berdekatan.')
  }

  await prisma.reservasi.create({
    data: {
      sofaId,
      nama: cleanedNama,
      jam: targetJam,
      jumlahOrang,
      deposit: deposit && deposit > 0 ? deposit : null,
      status: 'PENDING'
    }
  })

  await prisma.auditLog.create({
    data: {
      userId: null,
      aksi: 'CREATE_RESERVASI',
      entitas: 'Reservasi',
      detail: JSON.stringify({ sofaId, nama: cleanedNama, jam: targetJam.toISOString(), jumlahOrang, deposit: deposit || 0 })
    }
  })

  revalidatePath(`/reservasi`)
}

export async function updateReservasiStatus(id: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
  const reservation = await prisma.reservasi.findUnique({ where: { id } })
  if (!reservation) throw new Error('Reservasi tidak ditemukan.')

  if (status === 'COMPLETED' && reservation.status !== 'CONFIRMED') {
    throw new Error('Reservasi harus dikonfirmasi terlebih dahulu sebelum selesai.')
  }

  await prisma.reservasi.update({
    where: { id },
    data: { status }
  })

  await prisma.auditLog.create({
    data: {
      userId: null,
      aksi: 'UPDATE_RESERVASI_STATUS',
      entitas: 'Reservasi',
      detail: JSON.stringify({ reservasiId: id, previousStatus: reservation.status, nextStatus: status })
    }
  })

  revalidatePath(`/reservasi`)
}

export async function updateSetting(kunci: string, nilai: string) {
  await requireManager()
  let finalNilai = nilai

  if (kunci === 'PIN_MANAJER') {
    finalNilai = await bcrypt.hash(nilai, 10)

    const managerUser = await prisma.user.findFirst({
      where: { peran: 'MANAJER', isDeleted: false }
    })

    if (managerUser) {
      await prisma.user.update({
        where: { id: managerUser.id },
        data: { pin: finalNilai }
      })
    }
  }

  await prisma.setting.upsert({
    where: { kunci },
    update: { nilai: finalNilai },
    create: { kunci, nilai: finalNilai }
  })
  revalidatePath(`/settings`)
}

export async function addUser(nama: string, peran: string, pin: string) {
  await requireManager()
  const hashedPin = await bcrypt.hash(pin, 10)
  await prisma.user.create({ data: { nama, peran: peran as any, pin: hashedPin } })
  revalidatePath('/staf')
}

export async function editUser(id: string, nama: string, peran: string, pin?: string) {
  await requireManager()
  const data: any = { nama, peran: peran as any }
  if (pin) {
    data.pin = await bcrypt.hash(pin, 10)
  }
  await prisma.user.update({ where: { id }, data })
  revalidatePath('/staf')
}

export async function deleteUser(id: string) {
  await requireManager()
  await prisma.user.update({ where: { id }, data: { isDeleted: true } })
  revalidatePath('/staf')
}

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 menit

export async function getActiveUsers() {
  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    select: { id: true, nama: true, peran: true },
    orderBy: { nama: 'asc' }
  })
  return users
}

export async function loginWithUserAndPin(userId: string, pin: string) {
  if (!userId || !pin) return { error: 'Pilih nama dan masukkan PIN' }

  const user = await prisma.user.findUnique({ where: { id: userId, isDeleted: false } })
  if (!user || !user.pin) return { error: 'Pengguna tidak ditemukan.' }

  const now = new Date()

  // Check if locked
  if (user.lockedUntil && now < user.lockedUntil) {
    const menitSisa = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000)
    return { error: `Akun terkunci. Coba lagi dalam ${menitSisa} menit.` }
  }

  const pinValid = await bcrypt.compare(pin, user.pin)

  if (!pinValid) {
    const newCount = user.failedAttempts + 1
    if (newCount >= MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: userId },
        data: { failedAttempts: newCount, lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) }
      })
      return { error: `PIN salah ${MAX_ATTEMPTS}x. Akun dikunci selama 15 menit.` }
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: newCount }
    })
    return { error: `PIN salah. Sisa percobaan: ${MAX_ATTEMPTS - newCount}` }
  }

  // Login berhasil — reset counter
  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null }
  })

  await setSession({ id: user.id, nama: user.nama, peran: user.peran })
  return { success: true }
}

// Backward compat alias (for any remaining code)
export async function loginWithPin(pin: string) {
  const users = await prisma.user.findMany({ where: { isDeleted: false } })
  for (const u of users) {
    if (u.pin && await bcrypt.compare(pin, u.pin)) {
      await setSession({ id: u.id, nama: u.nama, peran: u.peran })
      return { success: true }
    }
  }
  return { error: 'PIN salah atau tidak ditemukan' }
}


export async function logoutUser() {
  await clearSession()
  redirect("/login")
}

export async function verifyAndUpdatePin(pinLama: string, pinBaru: string) {
  const [pinManajer, managerUser] = await Promise.all([
    prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } }),
    prisma.user.findFirst({ where: { peran: 'MANAJER', isDeleted: false } })
  ])

  const candidates = [pinManajer?.nilai, managerUser?.pin]
  const pinLamaValid = await comparePinWithCandidates(pinLama, candidates)

  if (!pinLamaValid) return { error: 'PIN lama salah' }
  if (pinBaru.length < 4) return { error: 'PIN baru minimal 4 digit' }

  const hashedNew = await bcrypt.hash(pinBaru, 10)
  await Promise.all([
    prisma.setting.upsert({
      where: { kunci: 'PIN_MANAJER' },
      update: { nilai: hashedNew },
      create: { kunci: 'PIN_MANAJER', nilai: hashedNew }
    }),
    managerUser
      ? prisma.user.update({ where: { id: managerUser.id }, data: { pin: hashedNew } })
      : Promise.resolve()
  ])
  revalidatePath('/settings')
  return { success: true }
}

export async function getEndOfDayReport(tanggal: string) {
  const start = getStartOfDayWIB(tanggal)
  const end = getEndOfDayWIB(tanggal)

  const [bills, voidItems, compItems, shifts, auditLogs] = await Promise.all([
    prisma.bill.findMany({
      where: { status: 'LUNAS', waktuTutup: { gte: start, lte: end } },
      include: { billItems: true, kasir: true, sofa: true }
    }),
    prisma.billItem.findMany({
      where: { isVoid: true, bill: { waktuBuka: { gte: start, lte: end } } },
      include: { bill: { include: { sofa: true } } }
    }),
    prisma.billItem.findMany({
      where: { isComp: true, bill: { waktuBuka: { gte: start, lte: end } } },
      include: { bill: { include: { sofa: true } } }
    }),
    prisma.shift.findMany({
      where: { waktuBuka: { gte: start, lte: end } },
      include: {
        kasir: true,
        bills: { where: { status: 'LUNAS' } }
      }
    }),
    prisma.auditLog.findMany({
      where: { waktu: { gte: start, lte: end } },
      include: { user: true },
      orderBy: { waktu: 'desc' },
      take: 50
    })
  ])

  const totalPendapatan = bills.reduce((s, b) => s + b.total, 0)
  const totalSubtotal = bills.reduce((s, b) => s + b.subtotal, 0)
  const totalPajak = bills.reduce((s, b) => s + b.pajak, 0)
  const totalService = bills.reduce((s, b) => s + b.service, 0)
  const totalDiskon = bills.reduce((s, b) => s + b.diskon, 0)
  const totalVoidNominal = voidItems.reduce((s, i) => s + i.harga * i.qty, 0)
  const totalCompNominal = compItems.reduce((s, i) => s + i.harga * i.qty, 0)
  const openingCash = shifts.reduce((s, shift) => s + (shift.kasAwal || 0), 0)
  const expenseCash = shifts.reduce((s, shift) => s + (shift.pengeluaran || 0), 0)

  const shiftCashSummary = summarizeShiftCash(shifts)
  const shiftSales = shifts.reduce(
    (sum, shift) => sum + shift.bills.reduce((billSum, bill) => billSum + bill.total, 0),
    0
  )
  const cashSales = shiftCashSummary.cashSales
  const nonCashSales = shiftSales - cashSales
  const expectedCash = shiftCashSummary.expectedCash
  const actualClosingCash = shiftCashSummary.actualClosingCash
  const cashDifference = shiftCashSummary.cashDifference
  const cashTolerance = 50000
  const cashStatus = cashDifference === null
    ? 'BELUM_DIHITUNG'
    : Math.abs(cashDifference) <= cashTolerance
      ? 'SESUAI'
      : Math.abs(cashDifference) <= cashTolerance * 2 ? 'WASPADA' : 'KRITIS'
  const cashStatusMessage = cashDifference === null
    ? 'Rekonsiliasi menunggu semua shift ditutup dan kas fisik dihitung.'
    : Math.abs(cashDifference) <= cashTolerance
      ? 'Rekonsiliasi kas sesuai toleransi yang diizinkan.'
      : Math.abs(cashDifference) <= cashTolerance * 2
        ? 'Ada selisih kas yang perlu diperiksa lebih lanjut.'
        : 'Selisih kas melebihi toleransi dan memerlukan review manajer.'

  const byMetode: Record<string, { count: number; total: number }> = {}
  for (const bill of bills) {
    const m = bill.metodeBayar || 'TUNAI'
    if (!byMetode[m]) byMetode[m] = { count: 0, total: 0 }
    byMetode[m].count++
    byMetode[m].total += bill.total
  }

  const bySofa: Record<string, { nama: string; count: number; total: number; average: number }> = {}
  for (const bill of bills) {
    const sId = bill.sofaId || 'TAKE_AWAY'
    const sNama = bill.sofa?.nama || (bill.tipe === 'TAKE_AWAY' ? 'Take Away' : 'Lainnya')
    
    if (!bySofa[sId]) {
      bySofa[sId] = { nama: sNama, count: 0, total: 0, average: 0 }
    }
    bySofa[sId].count++
    bySofa[sId].total += bill.total
    bySofa[sId].average = Math.round(bySofa[sId].total / bySofa[sId].count)
  }

  return {
    tanggal,
    bills,
    totalTransaksi: bills.length,
    totalPendapatan,
    totalSubtotal,
    totalPajak,
    totalService,
    totalDiskon,
    totalVoidNominal,
    totalCompNominal,
    openingCash,
    expenseCash,
    cashSales,
    nonCashSales,
    expectedCash,
    actualClosingCash,
    cashDifference,
    cashTolerance,
    cashStatus,
    cashStatusMessage,
    voidItems,
    compItems,
    byMetode,
    bySofa,
    shifts: shifts.map(({ bills: _bills, ...shift }) => shift),
    auditLogs
  }
}

export async function searchRiwayatBill(query: string, page: number = 1) {
  const PAGE_SIZE = 15
  const skip = (page - 1) * PAGE_SIZE

  const whereClause: any = { status: 'LUNAS' }

  if (query.trim()) {
    const isNumber = !isNaN(Number(query)) && query.trim() !== ''
    if (isNumber) {
      whereClause.nomorBill = Number(query)
    } else {
      whereClause.id = { contains: query }
    }
  }

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where: whereClause,
      include: { kasir: true, sofa: true },
      orderBy: { waktuTutup: 'desc' },
      skip,
      take: PAGE_SIZE
    }),
    prisma.bill.count({ where: whereClause })
  ])

  return { bills, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) }
}

export async function exportDatabaseToCSV() {
  // Fetch all LUNAS bills
  const bills = await prisma.bill.findMany({
    where: { status: 'LUNAS' },
    include: { kasir: true, sofa: true }
  })

  let csv = 'ID Bill,Nomor Bill,Waktu Buka,Waktu Tutup,Tipe,Sofa,Kasir,Subtotal,Diskon,Pajak,Service,Total,Metode Bayar\n'
  
  bills.forEach(b => {
    csv += `"${b.id}","${b.nomorBill || ''}","${b.waktuBuka.toISOString()}","${b.waktuTutup?.toISOString() || ''}","${b.tipe}","${b.sofa?.nama || ''}","${b.kasir?.nama || ''}",${b.subtotal},${b.diskon},${b.pajak},${b.service},${b.total},"${b.metodeBayar || ''}"\n`
  })

  return csv
}

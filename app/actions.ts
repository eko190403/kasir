"use server"

import { prisma } from "@/lib/prisma"
import { calculateBillTotalInTransaction, computeBillMathematics, getSettings } from "@/lib/bill"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { connection } from 'next/server'
import bcrypt from "bcryptjs"
import { setSession, logout as clearSession, getSession } from "@/lib/auth"
import { getStartOfDayWIB, getEndOfDayWIB, getOperationalBusinessDate, isTimeWithinRange, formatWIB, parseLocalWIBDateTime } from "@/lib/timezone"
import { withSerializableRetry } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { computeShiftCash } from "@/lib/shift-math"
import {
  applyHappyHourDiscount,
  getHappyHourOriginalPrice,
  isHappyHourMenuName,
  isHappyHourWindowActive,
  resolveHappyHourPrice
} from "@/lib/menu-catalog"
import { nextShiftExpenseTotal, normalizeShiftExpenseInput } from "@/lib/shift-expense"
import { selectTargetManagerForFailedPinAttempt } from "@/lib/manager-pin-lock"

// ─── Auth Helpers ───────────────────────────────────────────────────
const ROLE_ORDER = ["PELAYAN", "BARTENDER", "DAPUR", "KASIR", "MANAJER"] as const

type UserRole = (typeof ROLE_ORDER)[number]
const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

async function requireSession() {
  const session = await getSession()
  if (!session || typeof session.user?.id !== "string") {
    throw new Error("Anda harus login terlebih dahulu.")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, nama: true, peran: true, isDeleted: true }
  })
  if (!user || user.isDeleted) throw new Error("Sesi tidak berlaku. Silakan login kembali.")
  if (!ROLE_ORDER.includes(user.peran)) throw new Error("Role akun tidak valid. Silakan hubungi manajer.")

  const sessionUser = session.user
  if (
    sessionUser.id !== user.id ||
    sessionUser.nama !== user.nama ||
    sessionUser.peran !== user.peran
  ) {
    throw new Error("Sesi tidak berlaku. Silakan login kembali.")
  }

  return { ...session, user: { id: user.id, nama: user.nama, peran: user.peran } }
}

async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireSession()
  const currentRole = session.user.peran
  if (!allowedRoles.includes(currentRole)) {
    throw new Error(`Aksi ini hanya diperbolehkan untuk role: ${allowedRoles.join(", ")}.`)
  }
  return session
}

async function comparePinWithCandidates(pin: string, candidates: Array<string | null | undefined>) {
  const normalizedCandidates = [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate && candidate.trim())))]

  for (const candidate of normalizedCandidates) {
    try {
      if (await bcrypt.compare(pin, candidate)) return true
    } catch { /* Invalid or legacy plaintext PIN hashes are rejected. */ }
  }

  return false
}

async function verifyManagerPin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN manajer harus terdiri dari 4–6 digit.")

  const managers = await prisma.user.findMany({
    where: { peran: 'MANAJER', isDeleted: false, pin: { not: null } },
    select: { id: true, pin: true, failedAttempts: true, lockedUntil: true },
    orderBy: { id: 'asc' }
  })
  if (managers.length === 0) throw new Error("PIN manajer belum dikonfigurasi.")

  const now = new Date()
  const activeManagers = managers.filter((manager) => !manager.lockedUntil || now >= manager.lockedUntil)

  if (activeManagers.length === 0) {
    const lockedManager = [...managers].sort((a, b) => {
      const left = a.lockedUntil?.getTime() ?? Number.NEGATIVE_INFINITY
      const right = b.lockedUntil?.getTime() ?? Number.NEGATIVE_INFINITY
      return right - left
    })[0]
    const remaining = Math.ceil((lockedManager.lockedUntil!.getTime() - now.getTime()) / 60000)
    throw new Error(`Verifikasi PIN manajer terkunci. Coba lagi dalam ${remaining} menit.`)
  }

  for (const manager of activeManagers) {
    if (manager.pin && await comparePinWithCandidates(pin, [manager.pin])) {
      await prisma.user.update({
        where: { id: manager.id },
        data: { failedAttempts: 0, lockedUntil: null }
      })
      return manager.id
    }
  }

  const targetManagerId = selectTargetManagerForFailedPinAttempt(activeManagers, now)
  if (!targetManagerId) {
    throw new Error("PIN manajer tidak valid untuk akun yang aktif.")
  }

  const failedUser = await prisma.user.update({
    where: { id: targetManagerId },
    data: { failedAttempts: { increment: 1 } },
    select: { id: true, failedAttempts: true }
  })

  if (failedUser.failedAttempts >= MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: failedUser.id },
      data: { lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) }
    })
    throw new Error(`PIN manajer salah ${MAX_ATTEMPTS} kali. Verifikasi terkunci selama 15 menit.`)
  }

  throw new Error(`PIN manajer salah. Sisa percobaan: ${MAX_ATTEMPTS - failedUser.failedAttempts}.`)
}

async function allocateBillNumber(tx: Prisma.TransactionClient) {
  const businessDate = getOperationalBusinessDate()
  const counter = await tx.billCounter.upsert({
    where: { businessDate },
    create: { businessDate, last: 1 },
    update: { last: { increment: 1 } }
  })
  return { businessDate, nomorBill: counter.last }
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

async function assertBillAccessForSession(
  tx: Prisma.TransactionClient,
  billId: string,
  session: Awaited<ReturnType<typeof requireSession>>
) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      kasirId: true,
      shiftId: true,
      status: true,
      sofaId: true,
      pajakPct: true,
      servicePct: true,
      pembulatanRatusan: true
    }
  })

  if (!bill) throw new Error("Bill tidak ditemukan.")

  if (session.user.peran === "KASIR") {
    if (bill.kasirId && bill.kasirId !== session.user.id) {
      throw new Error("Hanya kasir pemilik bill atau manager yang dapat mengelola bill ini.")
    }

    if (bill.shiftId) {
      const shift = await tx.shift.findUnique({
        where: { id: bill.shiftId },
        select: { kasirId: true, waktuTutup: true }
      })
      if (!shift || shift.waktuTutup || shift.kasirId !== session.user.id) {
        throw new Error("Bill ini tidak terkait dengan shift aktif kasir Anda.")
      }
    } else {
      const activeShift = await tx.shift.findFirst({
        where: { kasirId: session.user.id, waktuTutup: null },
        select: { id: true }
      })
      if (!activeShift) {
        throw new Error("Buka shift terlebih dahulu sebelum mengelola bill.")
      }
    }
  }

  return bill
}

async function assertShiftAccessForSession(
  tx: Prisma.TransactionClient,
  shiftId: string,
  session: Awaited<ReturnType<typeof requireSession>>
) {
  const shift = await tx.shift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      kasirId: true,
      waktuBuka: true,
      waktuTutup: true,
      kasAwal: true,
      pengeluaran: true,
      catatanPengeluaran: true
    }
  })

  if (!shift) throw new Error("Shift tidak ditemukan.")

  if (session.user.peran === "KASIR" && shift.kasirId !== session.user.id) {
    throw new Error("Anda hanya dapat mengelola shift milik akun Anda sendiri.")
  }

  return shift
}

const POS_ROLES: UserRole[] = ["PELAYAN", "BARTENDER", "KASIR", "MANAJER"]
const KITCHEN_ROLES: UserRole[] = ["DAPUR", "BARTENDER", "KASIR", "MANAJER"]

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
  const session = await requireRole(POS_ROLES)
  const kasirId = session.user.id
  const bill = await withSerializableRetry(async (tx) => {
    const shift = await tx.shift.findFirst({ where: { kasirId, waktuTutup: null } })
    if (session.user.peran === "KASIR" && !shift) {
      throw new Error("Buka shift terlebih dahulu sebelum membuat bill.")
    }
    const settings = await getSettings(tx)
    const { businessDate, nomorBill } = await allocateBillNumber(tx)

    return tx.bill.create({
      data: {
        tipe: "TAKE_AWAY",
        status: "TERBUKA",
        kasirId,
        shiftId: shift?.id ?? null,
        businessDate,
        nomorBill,
        pajakPct: settings.pajak,
        servicePct: settings.serviceCharge,
        pembulatanRatusan: settings.pembulatanRatusan
      }
    })
  })
  redirect(`/bill/${bill.id}`)
}

export async function updateItemStatus(itemId: string, status: "DIKIRIM" | "DIPROSES" | "SIAP") {
  await requireRole(KITCHEN_ROLES)
  if (!["DIKIRIM", "DIPROSES", "SIAP"].includes(status)) throw new Error("Status item tidak valid.")

  const result = await prisma.billItem.updateMany({
    where: { id: itemId, bill: { status: "TERBUKA" } },
    data: { status }
  })
  if (result.count === 0) throw new Error("Item tidak ditemukan atau bill sudah ditutup.")
}

export async function getKitchenItems(kategori: "MAKANAN" | "MINUMAN") {
  await requireRole(KITCHEN_ROLES)
  if (!["MAKANAN", "MINUMAN"].includes(kategori)) throw new Error("Kategori dapur tidak valid.")

  return prisma.billItem.findMany({
    where: {
      status: { not: "SIAP" },
      menuItem: { kategori },
      bill: { status: "TERBUKA" },
      isVoid: false,
      isComp: false,
      diretur: false,
    },
    orderBy: { createdAt: 'asc' },
    include: { menuItem: true, bill: { include: { sofa: true } } }
  })
}


export async function createOrGetActiveBill(sofaId: string) {
  const session = await requireRole(POS_ROLES)
  try {
    return await withSerializableRetry(async (tx) => {
      const sofa = await tx.sofa.findUnique({ where: { id: sofaId } })
      if (!sofa || sofa.isDeleted) {
        throw new Error('Meja tidak ditemukan atau tidak aktif.')
      }

      let bill = await tx.bill.findFirst({
        where: { sofaId, status: "TERBUKA" },
        include: { billItems: true }
      })

      if (bill && session.user.peran === "KASIR" && bill.kasirId && bill.kasirId !== session.user.id) {
        throw new Error('Meja ini sedang digunakan oleh kasir lain. Pilih meja yang masih milik Anda.')
      }

      if (!bill) {
        const orphanOpenBills = await tx.bill.count({
          where: { sofaId, status: 'TERBUKA' }
        })

        if (orphanOpenBills > 0) {
          throw new Error('Meja ini sudah memiliki tagihan aktif.')
        }

        const kasirId = session.user.id
        let shiftId = undefined

        const shift = await tx.shift.findFirst({ where: { kasirId, waktuTutup: null } })
        if (session.user.peran === "KASIR" && !shift) {
          throw new Error("Buka shift terlebih dahulu sebelum membuat bill.")
        }
        if (shift) shiftId = shift.id

        const { businessDate, nomorBill } = await allocateBillNumber(tx)

        const settings = await getSettings(tx)

        bill = await tx.bill.create({
          data: {
            sofaId,
            tipe: "DINE_IN",
            status: "TERBUKA",
            kasirId,
            shiftId,
            businessDate,
            nomorBill,
            pajakPct: settings.pajak,
            servicePct: settings.serviceCharge,
            pembulatanRatusan: settings.pembulatanRatusan
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
      return bill
    })
  } catch (error) {
    if (!hasPrismaErrorCode(error, 'P2002')) throw error
    const concurrentBill = await prisma.bill.findFirst({
      where: { sofaId, status: 'TERBUKA' },
      include: { billItems: true }
    })
    if (!concurrentBill) throw error
    return concurrentBill
  }
}

export async function cleanupEmptyBills() {
  await requireRole([...ROLE_ORDER])
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
  const session = await requireRole(POS_ROLES)
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
  if (menuItem.isDeleted) throw new Error("Menu item sudah tidak aktif.")
  if (!menuItem.tersedia) throw new Error("Menu item habis")

  const currentTime = formatWIB(new Date(), 'HH:mm')
  const isFixedHappyHourItem = isHappyHourMenuName(menuItem.nama)
  if (isFixedHappyHourItem && !isHappyHourWindowActive(currentTime, '21:00', '23:00')) {
    throw new Error("Promo happy hour hanya tersedia pukul 21.00–23.00 WIB.")
  }

  const getSetting = (k: string, fb: string) => settings.find(s => s.kunci === k)?.nilai || fb
  const hhAktif = getSetting('HAPPY_HOUR_AKTIF', 'false') === 'true'
  const hhMulai = getSetting('HAPPY_HOUR_MULAI', '17:00')
  const hhSelesai = getSetting('HAPPY_HOUR_SELESAI', '20:00')
  const hhDiskon = Number(getSetting('HAPPY_HOUR_DISKON', '10'))
  if (!Number.isFinite(hhDiskon) || hhDiskon < 0 || hhDiskon > 100) {
    throw new Error('Pengaturan diskon happy hour harus antara 0 dan 100.')
  }

  let hargaFinal = menuItem.harga
  let isHhApplied = false

  if (!isFixedHappyHourItem && hhAktif && hhDiskon > 0) {
    if (isTimeWithinRange(currentTime, hhMulai, hhSelesai)) {
      hargaFinal = applyHappyHourDiscount(menuItem.harga, hhDiskon)
      isHhApplied = true
    }
  }

  const { item, totals } = await withSerializableRetry(async (tx) => {
    const bill = await assertBillAccessForSession(tx, billId, session)
    if (bill.status !== "TERBUKA") throw new Error("Pesanan hanya dapat ditambahkan ke bill yang masih terbuka.")

    const item = await tx.billItem.create({
      data: {
        billId,
        menuItemId,
        namaItem: menuItem.nama,
        harga: hargaFinal,
        hargaAsli: isFixedHappyHourItem
          ? getHappyHourOriginalPrice(menuItem.nama)
          : isHhApplied ? menuItem.harga : null,
        isHappyHour: isFixedHappyHourItem || isHhApplied,
        qty: parsedQty,
        catatan,
        status: "DIKIRIM"
      }
    })
    const totals = await calculateBillTotalInTransaction(tx, billId)
    return { item, totals }
  })
  revalidatePath(`/`)
  return { item, totals }
}

export async function updateItemQty(itemId: string, delta: number) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Perubahan jumlah item tidak valid.")
  const session = delta < 0 ? await requireManager() : await requireRole(POS_ROLES)

  await withSerializableRetry(async (tx) => {
    const item = await tx.billItem.findUnique({ where: { id: itemId } })
    if (!item) throw new Error("Item tidak ditemukan.")
    if (item.isVoid || item.isComp || item.diretur) throw new Error("Item sudah tidak aktif.")

    const bill = await assertBillAccessForSession(tx, item.billId, session)
    if (bill.status !== "TERBUKA") throw new Error("Item hanya dapat diubah saat bill masih terbuka.")

    const newQty = item.qty + delta
    if (newQty < 0) throw new Error("Jumlah item tidak boleh kurang dari nol.")

    const result = await tx.billItem.updateMany({
      where: { id: itemId, qty: item.qty, isVoid: false, isComp: false, diretur: false, bill: { status: "TERBUKA" } },
      data: newQty === 0
        ? { isVoid: true, alasanVoidComp: "Kuantitas dikurangi menjadi 0", otorisasiOleh: session.user.nama }
        : { qty: newQty }
    })
    if (result.count === 0) throw new Error("Item berubah bersamaan. Muat ulang bill dan coba lagi.")

    if (delta < 0) {
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          aksi: "REDUCE_ITEM_QTY",
          entitas: "BillItem",
          detail: { itemId, billId: item.billId, namaItem: item.namaItem, qtySebelumnya: item.qty, qtyTerbaru: newQty, otorisasi: session.user.nama }
        }
      })
    }

    await calculateBillTotalInTransaction(tx, item.billId)
    return item.billId
  })

  revalidatePath('/')
}

export async function cancelLunasBill(billId: string, alasan: string, pin: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan pembatalan')

  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) throw new Error('Bill not found')
  if (bill.status !== "LUNAS") throw new Error('Bill ini tidak berstatus LUNAS')

  await prisma.bill.update({
    where: { id: billId },
    data: { status: "BATAL" }
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      aksi: 'KOREKSI_BATAL_BILL_LUNAS',
      entitas: 'Bill',
      detail: {
        billId,
        nomorBill: bill.nomorBill,
        alasan: cleanedAlasan,
        otorisasi: session.user.nama,
        total: bill.total
      }
    }
  })

  revalidatePath('/riwayat')
  revalidatePath('/summary')
}

export async function cancelBill(billId: string, alasan: string, pin: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan pembatalan')
  const sofaId = await withSerializableRetry(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: billId } })
    if (!bill) throw new Error('Bill tidak ditemukan.')
    if (bill.status !== "TERBUKA") throw new Error('Hanya bill terbuka yang dapat dibatalkan.')
    const paymentsOnBill = await tx.payment.count({ where: { billId } })
    if (paymentsOnBill > 0) throw new Error('Bill memiliki deposit/pembayaran tercatat. Proses refund atau koreksi deposit terlebih dahulu.')

    const update = await tx.bill.updateMany({
      where: { id: billId, status: "TERBUKA" },
      data: { status: "BATAL", waktuTutup: new Date() }
    })
    if (update.count === 0) throw new Error('Bill sudah ditutup atau dibatalkan.')

    if (bill.sofaId) {
      const otherOpenBills = await tx.bill.count({
        where: { sofaId: bill.sofaId, status: "TERBUKA" }
      })
      if (otherOpenBills === 0) {
        await tx.sofa.update({
          where: { id: bill.sofaId },
          data: { status: "KOSONG" }
        })
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'CANCEL_BILL',
        entitas: 'Bill',
        detail: {
          billId,
          nomorBill: bill.nomorBill,
          alasan: cleanedAlasan,
          otorisasi: session.user.nama,
          total: bill.total,
          sofaId: bill.sofaId
        }
      }
    })
    return bill.sofaId
  })

  if (sofaId) revalidatePath(`/sofa/${sofaId}`)
  revalidatePath(`/`)
  revalidatePath(`/open-order`)
  revalidatePath(`/summary`)
  redirect("/")
}

function normalizePaymentMethod(metodeBayar?: string) {
  const raw = (metodeBayar ?? 'TUNAI').trim().toUpperCase()
  if (!raw) return 'TUNAI'
  if (raw.startsWith('SPLIT')) return 'SPLIT'
  if (raw === 'TRANSFER' || raw === 'BANK_TRANSFER') return 'TRANSFER'
  if (raw === 'DEBIT') return 'DEBIT'
  if (raw === 'CASH') return 'TUNAI'
  if (raw === 'KAS') return 'TUNAI'
  return raw === 'TUNAI' ? 'TUNAI' : raw
}

function normalizePaymentStatus(status?: string): "PENDING" | "SUDAH_BAYAR" | "GAGAL" | "BATAL" {
  const raw = (status ?? 'SUDAH_BAYAR').trim().toUpperCase()
  if (raw === 'PENDING' || raw === 'WAITING' || raw === 'MENUNGGU') return 'PENDING'
  if (raw === 'PAID' || raw === 'SUCCESS' || raw === 'SUDAH') return 'SUDAH_BAYAR'
  if (raw === 'FAILED' || raw === 'GAGAL') return 'GAGAL'
  if (raw === 'CANCELLED' || raw === 'CANCELED' || raw === 'BATAL') return 'BATAL'
  if (raw === 'SUDAH_BAYAR') return 'SUDAH_BAYAR'
  return 'SUDAH_BAYAR'
}

function normalizeAuditReason(alasan: string, label: string) {
  const cleaned = alasan.trim()
  if (!cleaned) throw new Error(`${label} wajib diisi.`)
  if (cleaned.length < 3) throw new Error(`${label} minimal 3 karakter.`)
  return cleaned
}

async function applyBillItemCorrection(
  itemId: string,
  alasan: string,
  aksi: "RETURN_ITEM" | "VOID_ITEM" | "COMP_ITEM",
  session: Awaited<ReturnType<typeof requireManager>>
) {
  const itemLabel = aksi === "RETURN_ITEM" ? "diretur" : aksi === "VOID_ITEM" ? "di-void" : "di-comp"
  const billId = await withSerializableRetry(async (tx) => {
    const item = await tx.billItem.findUnique({ where: { id: itemId } })
    if (!item) throw new Error("Item tidak ditemukan.")
    if (item.isVoid) throw new Error("Item ini sudah di-void.")
    if (item.isComp) throw new Error("Item ini sudah di-comp.")
    if (item.diretur) throw new Error("Item ini sudah diretur.")

    const bill = await assertBillAccessForSession(tx, item.billId, session)
    if (bill.status !== "TERBUKA") throw new Error(`Item hanya dapat ${itemLabel} pada bill yang masih terbuka.`)

    const correction = aksi === "RETURN_ITEM"
      ? { diretur: true }
      : aksi === "VOID_ITEM"
        ? { isVoid: true }
        : { isComp: true }
    const update = await tx.billItem.updateMany({
      where: { id: itemId, isVoid: false, isComp: false, diretur: false, bill: { status: "TERBUKA" } },
      data: { ...correction, alasanVoidComp: alasan, otorisasiOleh: session.user.nama }
    })
    if (update.count === 0) throw new Error("Item berubah bersamaan. Muat ulang bill dan coba lagi.")

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi,
        entitas: "BillItem",
        detail: { itemId, billId: item.billId, namaItem: item.namaItem, alasan, otorisasi: session.user.nama }
      }
    })
    await calculateBillTotalInTransaction(tx, item.billId)
    return item.billId
  })

  revalidatePath("/")
  revalidatePath("/summary")
  return billId
}

type BillPaymentInput = {
  metode: "TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER"
  jumlah: number
  referensi?: string
  status?: "PENDING" | "SUDAH_BAYAR" | "GAGAL" | "BATAL"
}

async function closeBillIfFullyPaid(
  tx: Prisma.TransactionClient,
  billId: string,
  session: Awaited<ReturnType<typeof requireSession>>
) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      sofaId: true,
      status: true,
      metodeBayar: true,
      uangDiterima: true,
      kembalian: true,
    },
  })
  if (!bill || bill.status !== "TERBUKA") return { closed: false, sofaId: bill?.sofaId ?? null }

  const totals = await calculateBillTotalInTransaction(tx, billId)
  const totalBill = Number(totals.total ?? 0)
  if (!Number.isSafeInteger(totalBill) || totalBill <= 0) {
    return { closed: false, sofaId: bill.sofaId }
  }

  const payments = await tx.payment.findMany({
    where: { billId },
    select: { metode: true, jumlah: true, status: true },
  })
  if (payments.some(payment => payment.status === "PENDING")) {
    return { closed: false, sofaId: bill.sofaId }
  }

  const confirmedPayments = payments.filter(payment => payment.status === "SUDAH_BAYAR")
  const totalDibayar = confirmedPayments.reduce((sum, payment) => sum + payment.jumlah, 0)
  if (totalDibayar > totalBill) {
    throw new Error("Pembayaran yang tercatat melebihi total bill. Hubungi manajer.")
  }
  if (totalDibayar !== totalBill) return { closed: false, sofaId: bill.sofaId }

  const metodePembayaran = [...new Set(confirmedPayments.map(payment => payment.metode))]
  const metodeBayar = metodePembayaran.length === 1
    ? metodePembayaran[0]
    : `SPLIT (${metodePembayaran.join("+")})`
  const pembayaranTunai = confirmedPayments
    .filter(payment => payment.metode === "TUNAI")
    .reduce((sum, payment) => sum + payment.jumlah, 0)
  const uangDiterima = pembayaranTunai > 0
    ? Math.max(pembayaranTunai, bill.uangDiterima ?? pembayaranTunai)
    : null

  const update = await tx.bill.updateMany({
    where: { id: billId, status: "TERBUKA" },
    data: {
      status: "LUNAS",
      waktuTutup: new Date(),
      metodeBayar: metodeBayar || bill.metodeBayar || "TUNAI",
      uangDiterima,
      kembalian: uangDiterima === null ? 0 : Math.max(0, uangDiterima - pembayaranTunai),
    },
  })
  if (update.count === 0) return { closed: false, sofaId: bill.sofaId }

  if (bill.sofaId) {
    const otherOpenBills = await tx.bill.count({
      where: { sofaId: bill.sofaId, status: "TERBUKA" },
    })
    if (otherOpenBills === 0) {
      await tx.sofa.update({
        where: { id: bill.sofaId },
        data: { status: "KOSONG" },
      })
    }
  }

  await tx.auditLog.create({
    data: {
      userId: session.user.id,
      aksi: "CLOSE_BILL",
      entitas: "Bill",
      detail: {
        billId,
        total: totalBill,
        metodeBayar,
        pembayaran: confirmedPayments,
        ditutupOtomatisSetelahKonfirmasi: true,
        otorisasi: session.user.nama,
      },
    },
  })

  return { closed: true, sofaId: bill.sofaId }
}

export async function confirmPayment(paymentId: string) {
  const session = await requireRole(POS_ROLES)
  if (!paymentId || !paymentId.trim()) throw new Error("Pembayaran tidak valid.")

  const result = await withSerializableRetry(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { bill: true }
    })
    if (!payment) throw new Error("Pembayaran tidak ditemukan.")

    const bill = await assertBillAccessForSession(tx, payment.billId, session)
    if (bill.status !== "TERBUKA") {
      throw new Error("Pembayaran hanya bisa dikonfirmasi pada bill yang masih terbuka.")
    }

    if (payment.status === "BATAL" || payment.status === "GAGAL") {
      throw new Error("Pembayaran yang gagal atau dibatalkan tidak bisa dikonfirmasi ulang.")
    }

    if (payment.status !== "SUDAH_BAYAR") {
      if (payment.metode === "TUNAI") {
        throw new Error("Pembayaran tunai langsung dianggap sah tanpa konfirmasi tambahan.")
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "SUDAH_BAYAR",
          confirmedAt: new Date(),
          confirmedByUserId: session.user.id,
        }
      })
    }

    return closeBillIfFullyPaid(tx, payment.billId, session)
  })

  revalidatePath(`/`)
  revalidatePath(`/dine-in`)
  revalidatePath(`/summary`)
  if (result.sofaId) revalidatePath(`/sofa/${result.sofaId}`)
  return result
}

function requiresManualConfirmation(metodeBayar?: string) {
  const normalized = normalizePaymentMethod(metodeBayar)
  return ['QRIS', 'DEBIT', 'TRANSFER'].includes(normalized)
}

export async function closeBill(
  billId: string,
  metodeBayar: string,
  uangDiterima?: number,
  paymentEntries?: BillPaymentInput[]
) {
  const session = await requireRole(POS_ROLES)
  if (typeof metodeBayar !== "string") throw new Error("Metode pembayaran tidak valid.")

  const normalizedMethod = normalizePaymentMethod(metodeBayar)
  const validMethods = ['TUNAI', 'KARTU', 'QRIS', 'DEBIT', 'TRANSFER', 'SPLIT']
  if (!validMethods.includes(normalizedMethod)) {
    throw new Error('Metode pembayaran tidak valid.')
  }

  const closedBill = await withSerializableRetry(async (tx) => {
    const bill = await assertBillAccessForSession(tx, billId, session)
    if (bill.status !== 'TERBUKA') throw new Error('Bill ini sudah ditutup atau dibatalkan.')

    const calculatedTotals = await calculateBillTotalInTransaction(tx, billId)
    const totalBill = Number(calculatedTotals.total ?? 0)
    if (!Number.isFinite(totalBill) || totalBill < 0) {
      throw new Error('Total bill tidak valid untuk proses pembayaran.')
    }

    const previousPayments = await tx.payment.findMany({
      where: { billId },
      select: { id: true, metode: true, jumlah: true, referensi: true, status: true }
    })
    const pendingExistingPayments = previousPayments.filter(payment => payment.status === 'PENDING')
    const validPreviousPayments = previousPayments.filter(payment => payment.status !== 'PENDING' && payment.status !== 'GAGAL' && payment.status !== 'BATAL')
    const totalSudahDibayar = validPreviousPayments.reduce((sum, payment) => sum + payment.jumlah, 0)
    if (totalSudahDibayar > totalBill) {
      throw new Error('Pembayaran yang tercatat melebihi total bill. Hubungi manajer.')
    }

    const sisaPembayaran = totalBill - totalSudahDibayar
    const basePayments = (paymentEntries ?? (normalizedMethod === 'SPLIT'
      ? []
      : sisaPembayaran > 0
        ? [{ metode: normalizedMethod as BillPaymentInput["metode"], jumlah: sisaPembayaran, status: (requiresManualConfirmation(normalizedMethod) ? 'PENDING' : 'SUDAH_BAYAR') as BillPaymentInput['status'] }]
        : []))
      .map(payment => ({
        ...payment,
        status: payment.status ? normalizePaymentStatus(payment.status) : (requiresManualConfirmation(payment.metode) ? 'PENDING' : 'SUDAH_BAYAR')
      }))

    if (basePayments.some(payment =>
      !['TUNAI', 'KARTU', 'QRIS', 'DEBIT', 'TRANSFER'].includes(payment.metode) ||
      !Number.isSafeInteger(payment.jumlah) ||
      payment.jumlah <= 0 ||
      (payment.status !== undefined && !['PENDING', 'SUDAH_BAYAR'].includes(payment.status)) ||
      (payment.referensi !== undefined && payment.referensi.trim().length > 120)
    )) {
      throw new Error('Rincian pembayaran tidak valid. QRIS/debit/transfer harus sudah dikonfirmasi sebagai SUDAH_BAYAR atau menunggu konfirmasi manual.')
    }

    if (pendingExistingPayments.length > 0 && basePayments.length > 0) {
      throw new Error('Masih ada pembayaran yang menunggu konfirmasi. Konfirmasi atau batalkan pembayaran tersebut sebelum membuat pembayaran baru.')
    }

    const confirmedPayments = basePayments.filter(payment => payment.status === 'SUDAH_BAYAR')
    const pendingPayments = [...pendingExistingPayments, ...basePayments.filter(payment => payment.status === 'PENDING')]
    if (pendingPayments.length > 0) {
      if (basePayments.length > 0) {
        await tx.payment.createMany({
          data: basePayments.map(payment => ({
            billId,
            metode: payment.metode,
            jumlah: payment.jumlah,
            referensi: payment.referensi?.trim() || null,
            status: payment.status,
            confirmedAt: payment.status === 'SUDAH_BAYAR' ? new Date() : null,
            confirmedByUserId: payment.status === 'SUDAH_BAYAR' ? session.user.id : null,
          }))
        })
      }

      return { sofaId: bill.sofaId, status: 'PENDING_CONFIRMATION' as const }
    }

    const totalDibayar = [...validPreviousPayments, ...confirmedPayments].reduce((sum, payment) => sum + payment.jumlah, 0)
    if (totalDibayar !== totalBill) throw new Error('Jumlah alokasi pembayaran harus sama dengan total bill.')

    const pembayaranTunai = basePayments
      .filter(payment => payment.metode === 'TUNAI')
      .reduce((sum, payment) => sum + payment.jumlah, 0)
    const nominalDiterima = pembayaranTunai > 0 ? Number(uangDiterima ?? pembayaranTunai) : 0
    if (!Number.isSafeInteger(nominalDiterima) || nominalDiterima < 0) {
      throw new Error('Nominal uang yang diterima tidak valid.')
    }
    if (nominalDiterima < pembayaranTunai) {
      throw new Error('Uang tunai yang diterima kurang dari alokasi tunai.')
    }
    const allPaymentMethods = [...validPreviousPayments, ...basePayments].map(payment => payment.metode)
    const uniquePaymentMethods = [...new Set(allPaymentMethods)]
    const metodeTersimpan = uniquePaymentMethods.length === 1
      ? uniquePaymentMethods[0]
      : uniquePaymentMethods.length > 1
        ? `SPLIT (${uniquePaymentMethods.join('+')})`
        : normalizedMethod
    const kembalian = nominalDiterima - pembayaranTunai
    const activeShift = !bill.shiftId && session.user.peran === "KASIR"
      ? await tx.shift.findFirst({ where: { kasirId: session.user.id, waktuTutup: null } })
      : null
    if (!bill.shiftId && session.user.peran === "KASIR" && !activeShift) {
      throw new Error("Kasir harus memiliki shift aktif untuk menutup bill.")
    }

    const update = await tx.bill.updateMany({
      where: { id: billId, status: "TERBUKA" },
      data: {
        status: "LUNAS",
        waktuTutup: new Date(),
        metodeBayar: metodeTersimpan,
        shiftId: bill.shiftId ?? activeShift?.id,
        uangDiterima: pembayaranTunai > 0 ? nominalDiterima : null,
        kembalian
      }
    })
    if (update.count === 0) throw new Error('Bill ini sudah ditutup atau dibatalkan.')
    if (basePayments.length > 0) {
      const normalizedPayments = basePayments.map(payment => ({
        billId,
        metode: payment.metode,
        jumlah: payment.jumlah,
        referensi: payment.referensi?.trim() || null,
        status: payment.status,
        confirmedAt: payment.status === 'SUDAH_BAYAR' ? new Date() : null,
        confirmedByUserId: payment.status === 'SUDAH_BAYAR' ? session.user.id : null,
      }))
      await tx.payment.createMany({ data: normalizedPayments as any })
    }

    if (bill.sofaId) {
      const otherOpenBills = await tx.bill.count({
        where: { sofaId: bill.sofaId, status: "TERBUKA" }
      })
      if (otherOpenBills === 0) {
        await tx.sofa.update({
          where: { id: bill.sofaId },
          data: { status: "KOSONG" }
        })
      }
    }

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'CLOSE_BILL',
        entitas: 'Bill',
        detail: {
          billId,
          metodeBayar: metodeTersimpan,
          pembayaran: [...validPreviousPayments, ...basePayments],
          total: totalBill,
          uangDiterima: nominalDiterima,
          kembalian,
          pajakPct: bill.pajakPct,
          servicePct: bill.servicePct,
          pembulatan: calculatedTotals.pembulatan
        }
      }
    })

    return { sofaId: bill.sofaId, status: 'CLOSED' as const }
  })

  if (closedBill.sofaId) revalidatePath(`/sofa/${closedBill.sofaId}`)
  revalidatePath(`/`)
  revalidatePath(`/open-order`)
  revalidatePath(`/summary`)
  return closedBill
}

export async function returnItem(itemId: string, alasan: string, pin?: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan retur')
  await applyBillItemCorrection(itemId, cleanedAlasan, "RETURN_ITEM", session)
}

export async function voidItem(itemId: string, alasan: string, pin: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan void')
  await applyBillItemCorrection(itemId, cleanedAlasan, "VOID_ITEM", session)
}

export async function compItem(itemId: string, alasan: string, pin: string) {
  const session = await requireManager(pin)
  const cleanedAlasan = normalizeAuditReason(alasan, 'Alasan comp')
  await applyBillItemCorrection(itemId, cleanedAlasan, "COMP_ITEM", session)
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
      detail: {
        menuItemId,
        nama: item.nama,
        kategori: item.kategori,
        tersedia: nextAvailability,
        otorisasi: session.user.nama
      }
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
      detail: { menuItemId: created.id, nama: cleanedNama, harga: parsedHarga, kategori, otorisasi: session.user.nama }
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
      detail: {
        menuItemId: id,
        sebelumnya: { nama: current.nama, harga: current.harga, kategori: current.kategori },
        terbaru: { nama: cleanedNama, harga: parsedHarga, kategori },
        otorisasi: session.user.nama
      }
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
      detail: { menuItemId: id, nama: item.nama, kategori: item.kategori, otorisasi: session.user.nama }
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
  await requireRole(["MANAJER", "KASIR"])
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
  await requireRole(["MANAJER", "KASIR"])
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
  await requireRole(["MANAJER", "KASIR"])
  // Check if sofa has active/open bill
  const activeBill = await prisma.bill.findFirst({ where: { sofaId: id, status: 'TERBUKA' } })
  if (activeBill) throw new Error('Meja sedang digunakan dan memiliki tagihan aktif. Tutup tagihan terlebih dahulu.')
  await prisma.sofa.update({ where: { id }, data: { isDeleted: true } })
  revalidatePath('/sofas')
  revalidatePath('/')
}

export async function applyDiscount(billId: string, diskon: number) {
  const session = await requireRole(POS_ROLES)
  if (!Number.isInteger(diskon) || diskon < 0) throw new Error('Diskon harus berupa nominal rupiah bulat dan tidak negatif.')

  await withSerializableRetry(async (tx) => {
    const bill = await assertBillAccessForSession(tx, billId, session)
    if (bill.status !== "TERBUKA") throw new Error('Diskon hanya dapat diubah pada bill yang masih terbuka.')

    const billWithItems = await tx.bill.findUnique({ where: { id: billId }, include: { billItems: true } })
    if (!billWithItems) throw new Error('Bill tidak ditemukan.')

    const subtotal = billWithItems.billItems.reduce((sum, item) =>
      item.isVoid || item.isComp || item.diretur ? sum : sum + item.harga * item.qty, 0)
    if (diskon > subtotal) throw new Error('Diskon tidak boleh melebihi subtotal bill.')

    const totals = computeBillMathematics({
      items: billWithItems.billItems,
      diskon,
      pajakRate: bill.pajakPct,
      serviceRate: bill.servicePct,
      pembulatanRatusan: bill.pembulatanRatusan
    })
    const update = await tx.bill.updateMany({
      where: { id: billId, status: "TERBUKA" },
      data: {
        diskon: totals.diskon,
        subtotal: totals.subtotal,
        service: totals.service,
        pajak: totals.pajak,
        pembulatan: totals.pembulatan,
        total: totals.total
      }
    })
    if (update.count === 0) throw new Error('Bill sudah ditutup atau dibatalkan.')

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'APPLY_DISCOUNT',
        entitas: 'Bill',
        detail: { billId, diskon, subtotal: totals.subtotal, otorisasi: session.user.nama }
      }
    })
  })

  revalidatePath(`/`)
}

export async function pindahSofa(billId: string, sofaBaruId: string) {
  const session = await requireRole(POS_ROLES)
  if (!sofaBaruId) throw new Error('Pilih meja tujuan.')
  const sofaLama = await withSerializableRetry(async (tx) => {
    const bill = await assertBillAccessForSession(tx, billId, session)
    if (bill.status !== "TERBUKA") throw new Error('Hanya bill terbuka yang dapat dipindahkan.')
    if (!bill.sofaId) throw new Error('Bill ini tidak terkait sofa.')
    if (bill.sofaId === sofaBaruId) throw new Error('Bill sudah berada di meja tersebut.')

    const target = await tx.sofa.findUnique({ where: { id: sofaBaruId } })
    if (!target || target.isDeleted) throw new Error('Meja tujuan tidak ditemukan atau tidak aktif.')
    const targetOpenBills = await tx.bill.count({ where: { sofaId: sofaBaruId, status: "TERBUKA" } })
    if (targetOpenBills > 0) throw new Error('Meja tujuan sudah memiliki bill terbuka.')

    const update = await tx.bill.updateMany({
      where: { id: billId, sofaId: bill.sofaId, status: "TERBUKA" },
      data: { sofaId: sofaBaruId }
    })
    if (update.count === 0) throw new Error('Bill berubah bersamaan. Muat ulang dan coba lagi.')

    await tx.sofa.update({ where: { id: sofaBaruId }, data: { status: "TERISI" } })
    const oldOpenBills = await tx.bill.count({ where: { sofaId: bill.sofaId, status: "TERBUKA" } })
    if (oldOpenBills === 0) {
      await tx.sofa.update({ where: { id: bill.sofaId }, data: { status: "KOSONG" } })
    }
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'PINDAH_SOFA',
        entitas: 'Bill',
        detail: { billId, dari: bill.sofaId, ke: sofaBaruId, otorisasi: session.user.nama }
      }
    })
    return bill.sofaId
  })

  revalidatePath(`/`)
  revalidatePath(`/sofa/${sofaLama}`)
  revalidatePath(`/sofa/${sofaBaruId}`)
}

export async function setSofaStatus(sofaId: string, status: "KOSONG" | "TERISI" | "MENUNGGU_MAKANAN" | "SIAP_BAYAR") {
  await requireRole(POS_ROLES)
  if (!["KOSONG", "TERISI", "MENUNGGU_MAKANAN", "SIAP_BAYAR"].includes(status)) {
    throw new Error("Status meja tidak valid.")
  }
  await withSerializableRetry(async (tx) => {
    const sofa = await tx.sofa.findUnique({ where: { id: sofaId } })
    if (!sofa || sofa.isDeleted) throw new Error("Meja tidak ditemukan atau tidak aktif.")
    if (status === "KOSONG") {
      const openBill = await tx.bill.findFirst({ where: { sofaId, status: "TERBUKA" } })
      if (openBill) throw new Error("Meja masih memiliki bill terbuka.")
    }
    await tx.sofa.update({ where: { id: sofaId }, data: { status } })
  })
  revalidatePath(`/`)
  revalidatePath(`/dine-in`)
  revalidatePath(`/sofa/${sofaId}`)
  return { success: true as const }
}

export async function openShift(kasirId: string, kasAwal: number) {
  const session = await requireRole(["MANAJER", "KASIR"])
  if (!Number.isInteger(kasAwal) || kasAwal < 0) throw new Error("Kas awal harus berupa rupiah bulat dan tidak negatif.")

  let shift
  try {
    shift = await withSerializableRetry(async (tx) => {
      const targetKasirId = session.user.peran === "KASIR" ? session.user.id : kasirId
      if (!targetKasirId) throw new Error("Pilih kasir untuk membuka shift.")
      const kasir = await tx.user.findFirst({
        where: { id: targetKasirId, peran: "KASIR", isDeleted: false },
        select: { id: true }
      })
      if (!kasir) throw new Error("Kasir tidak ditemukan atau tidak aktif.")
      const existing = await tx.shift.findFirst({ where: { kasirId: targetKasirId, waktuTutup: null } })
      if (existing) throw new Error('Shift masih terbuka. Tutup shift dulu.')
      return tx.shift.create({ data: { kasirId: targetKasirId, kasAwal } })
    })
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002')) {
      throw new Error('Shift untuk kasir ini baru saja dibuka. Muat ulang daftar shift.')
    }
    throw error
  }

  revalidatePath(`/shift`)
  return shift
}

export async function closeShift(shiftId: string, kasHitung: number, pin?: string) {
  const session = await requireSession()
  await requireManager(pin)
  if (!Number.isSafeInteger(kasHitung) || kasHitung < 0) {
    throw new Error("Kas fisik yang dihitung harus berupa rupiah bulat dan tidak negatif.")
  }

  await withSerializableRetry(async (tx) => {
    const shift = await assertShiftAccessForSession(tx, shiftId, session)
    if (shift.waktuTutup) throw new Error('Shift ini sudah ditutup.')

    const openBillRecords = await tx.bill.findMany({
      where: { shiftId, status: "TERBUKA" },
      select: { id: true },
    })
    for (const bill of openBillRecords) {
      await closeBillIfFullyPaid(tx, bill.id, session)
    }

    const remainingOpenBills = await tx.bill.count({ where: { shiftId, status: 'TERBUKA' } })
    if (remainingOpenBills > 0) {
      throw new Error(`Tidak bisa tutup shift. Masih ada ${remainingOpenBills} tagihan yang belum lunas/ditutup.`)
    }

    const bills = await tx.bill.findMany({
      where: { status: 'LUNAS', shiftId, waktuTutup: { gte: shift.waktuBuka } },
      include: { payments: true }
    })
    const cash = computeShiftCash(shift.kasAwal, shift.pengeluaran, bills, kasHitung)
    const { totalPenjualan, penjualanTunai: kasTunai, expectedCash, selisih } = cash
    const update = await tx.shift.updateMany({
      where: { id: shiftId, waktuTutup: null },
      data: { waktuTutup: new Date(), kasAkhir: kasHitung, kasHitung, selisih: selisih ?? 0, totalPenjualan }
    })
    if (update.count === 0) throw new Error('Shift sudah ditutup oleh proses lain.')

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'CLOSE_SHIFT',
        entitas: 'Shift',
        detail: {
          shiftId,
          kasAwal: shift.kasAwal,
          totalPenjualan,
          kasTunai,
          pengeluaran: shift.pengeluaran,
          kasHitung,
          expectedCash,
          selisih,
          otorisasi: session.user.nama
        }
      }
    })
  })

  revalidatePath(`/shift`)
  revalidatePath(`/`)
  revalidatePath(`/dine-in`)
  revalidatePath(`/open-order`)
  revalidatePath(`/summary`)
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

  await withSerializableRetry(async (tx) => {
    const currentShift = await assertShiftAccessForSession(tx, shiftId, session)
    if (currentShift.waktuTutup) throw new Error("Pengeluaran hanya dapat dicatat pada shift yang masih aktif.")

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
        detail: { shiftId, jumlah: expense.jumlah, catatan: expense.catatan, otorisasi: session.user.nama }
      }
    })
  })

  revalidatePath(`/shift`)
}

export async function createReservasi(
  sofaId: string,
  nama: string,
  jam: string,
  jumlahOrang: number,
  deposit?: number,
  noHp?: string,
  depositMetode?: BillPaymentInput["metode"]
) {
  const session = await requireRole(POS_ROLES)
  const cleanedNama = nama.trim()
  if (!sofaId) throw new Error('Pilih sofa terlebih dahulu.')
  if (!cleanedNama || cleanedNama.length > 120) throw new Error('Nama tamu wajib diisi dan maksimal 120 karakter.')
  if (!Number.isSafeInteger(jumlahOrang) || jumlahOrang <= 0) throw new Error('Jumlah orang harus bilangan bulat dan lebih dari 0.')
  if (deposit !== undefined && (!Number.isSafeInteger(deposit) || deposit < 0)) {
    throw new Error('Deposit harus berupa rupiah bulat dan tidak negatif.')
  }
  if (deposit && deposit > 0 && !['TUNAI', 'KARTU', 'QRIS', 'DEBIT', 'TRANSFER'].includes(depositMetode ?? '')) {
    throw new Error('Pilih metode pembayaran untuk deposit reservasi.')
  }
  const cleanedNoHp = noHp?.trim() ?? ''
  if (cleanedNoHp && !/^\+?[0-9 ()-]{7,20}$/.test(cleanedNoHp)) {
    throw new Error('Nomor telepon reservasi tidak valid.')
  }

  const targetJam = parseLocalWIBDateTime(jam)
  const windowStart = new Date(targetJam.getTime() - 30 * 60 * 1000)
  const windowEnd = new Date(targetJam.getTime() + 2 * 60 * 60 * 1000)

  await withSerializableRetry(async (tx) => {
    const sofa = await tx.sofa.findUnique({ where: { id: sofaId } })
    if (!sofa || sofa.isDeleted) throw new Error('Sofa tidak ditemukan atau tidak aktif.')
    if (sofa.kapasitas < jumlahOrang) throw new Error(`Kapasitas sofa ${sofa.nama} hanya ${sofa.kapasitas} orang.`)

    const conflict = await tx.reservasi.count({
      where: { sofaId, status: { not: 'CANCELLED' }, jam: { gte: windowStart, lte: windowEnd } }
    })
    if (conflict > 0) throw new Error('Sofa sudah memiliki reservasi pada rentang waktu yang berdekatan.')

    await tx.reservasi.create({
      data: {
        sofaId,
        nama: cleanedNama,
        jam: targetJam,
        jumlahOrang,
        deposit: deposit && deposit > 0 ? deposit : null,
        depositMetode: deposit && deposit > 0 ? depositMetode : null,
        noHp: cleanedNoHp || null,
        status: 'PENDING'
      }
    })
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'CREATE_RESERVASI',
        entitas: 'Reservasi',
        detail: { sofaId, nama: cleanedNama, jam: targetJam.toISOString(), jumlahOrang, deposit: deposit || 0, depositMetode: depositMetode ?? null, noHp: cleanedNoHp || null, otorisasi: session.user.nama }
      }
    })
  })

  revalidatePath(`/reservasi`)
}

export async function applyReservationDeposit(
  billId: string,
  reservasiId: string,
  legacyDepositMetode?: BillPaymentInput["metode"]
) {
  const session = await requireRole(POS_ROLES)
  await withSerializableRetry(async (tx) => {
    const bill = await assertBillAccessForSession(tx, billId, session)
    if (bill.status !== 'TERBUKA') throw new Error('Deposit hanya dapat diterapkan ke bill yang masih terbuka.')
    if (!bill.sofaId) throw new Error('Deposit reservasi hanya dapat diterapkan ke bill meja.')

    const reservation = await tx.reservasi.findUnique({ where: { id: reservasiId } })
    if (!reservation || reservation.sofaId !== bill.sofaId) {
      throw new Error('Reservasi tidak ditemukan untuk meja pada bill ini.')
    }
    if (reservation.status !== 'CONFIRMED' || reservation.billId) {
      throw new Error('Reservasi harus terkonfirmasi dan belum terhubung ke bill.')
    }
    if (!reservation.deposit || reservation.deposit <= 0) {
      throw new Error('Reservasi ini tidak memiliki deposit.')
    }
    const metode = reservation.depositMetode ?? legacyDepositMetode
    if (!metode || !['TUNAI', 'KARTU', 'QRIS', 'DEBIT', 'TRANSFER'].includes(metode)) {
      throw new Error('Pilih metode pembayaran untuk deposit reservasi lama.')
    }

    const calculatedTotals = await calculateBillTotalInTransaction(tx, billId)
    const existingPayments = await tx.payment.aggregate({
      where: { billId },
      _sum: { jumlah: true }
    })
    if (reservation.deposit > calculatedTotals.total - (existingPayments._sum.jumlah ?? 0)) {
      throw new Error('Deposit melebihi sisa tagihan bill.')
    }

    const linked = await tx.reservasi.updateMany({
      where: { id: reservasiId, status: 'CONFIRMED', billId: null },
      data: { billId: bill.id, depositMetode: metode }
    })
    if (linked.count === 0) throw new Error('Reservasi baru saja dipasangkan ke bill lain.')

    await tx.payment.create({
      data: {
        billId,
        metode,
        jumlah: reservation.deposit,
        referensi: `Deposit reservasi: ${reservation.nama}`
      }
    })
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'APPLY_RESERVATION_DEPOSIT',
        entitas: 'Bill',
        detail: {
          billId,
          reservasiId,
          jumlah: reservation.deposit,
          metode,
          otorisasi: session.user.nama
        }
      }
    })
  })

  revalidatePath(`/bill/${billId}`)
  revalidatePath(`/reservasi`)
  revalidatePath(`/summary`)
}

export async function updateReservasiStatus(id: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
  const session = await requireRole(POS_ROLES)
  if (!['CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) throw new Error('Status reservasi tidak valid.')
  const reservation = await prisma.reservasi.findUnique({ where: { id } })
  if (!reservation) throw new Error('Reservasi tidak ditemukan.')
  if (reservation.billId && status === 'CANCELLED') {
    throw new Error('Reservasi yang depositnya sudah diterapkan ke bill tidak dapat dibatalkan dari layar reservasi.')
  }

  const transitions: Record<string, string[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'CANCELLED']
  }
  if (!transitions[reservation.status]?.includes(status)) {
    throw new Error(`Reservasi ${reservation.status} tidak dapat diubah menjadi ${status}.`)
  }

  await withSerializableRetry(async (tx) => {
    const updated = await tx.reservasi.updateMany({
      where: { id, status: reservation.status },
      data: { status }
    })
    if (updated.count === 0) throw new Error('Status reservasi berubah bersamaan. Muat ulang lalu coba lagi.')
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        aksi: 'UPDATE_RESERVASI_STATUS',
        entitas: 'Reservasi',
        detail: { reservasiId: id, previousStatus: reservation.status, nextStatus: status, otorisasi: session.user.nama }
      }
    })
  })

  revalidatePath(`/reservasi`)
}

export async function updateSetting(kunci: string, nilai: string) {
  await requireManager()
  let finalNilai = nilai

  if (kunci === 'PAJAK' || kunci === 'SERVICE_CHARGE' || kunci === 'HAPPY_HOUR_DISKON') {
    if (nilai.trim() === '') throw new Error(`${kunci} wajib diisi.`)
    const rate = Number(nilai)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error(`${kunci} harus berupa angka antara 0 dan 100.`)
    }
    finalNilai = String(rate)
  }
  if (kunci === 'PEMBULATAN_RATUSAN' || kunci === 'HAPPY_HOUR_AKTIF') {
    if (!['true', 'false'].includes(nilai)) throw new Error(`${kunci} harus bernilai true atau false.`)
  }

  if (kunci === 'PIN_MANAJER') throw new Error('PIN manajer dikelola melalui akun staf, bukan Settings.')

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

export async function getActiveUsers() {
  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    select: { id: true, nama: true, peran: true },
    orderBy: { nama: 'asc' }
  })
  return users
}

export async function loginWithUserAndPin(userId: string, pin: string) {
  if (!userId || !/^\d{4,6}$/.test(pin)) return { error: 'Pilih nama dan masukkan PIN 4–6 digit.' }

  const user = await prisma.user.findUnique({ where: { id: userId, isDeleted: false } })
  if (!user || !user.pin) return { error: 'Pengguna tidak ditemukan.' }

  const now = new Date()

  if (user.lockedUntil && now < user.lockedUntil) {
    const menitSisa = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000)
    return { error: `Akun terkunci. Coba lagi dalam ${menitSisa} menit.` }
  }
  if (user.lockedUntil && now >= user.lockedUntil) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedUntil: null }
    })
  }

  const pinValid = await comparePinWithCandidates(pin, [user.pin])

  if (!pinValid) {
    const failedUser = await prisma.user.update({
      where: { id: userId, isDeleted: false },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true }
    })
    const newCount = failedUser.failedAttempts
    if (newCount >= MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: userId },
        data: { failedAttempts: newCount, lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) }
      })
      return { error: `PIN salah ${MAX_ATTEMPTS}x. Akun dikunci selama 15 menit.` }
    }
    return { error: `PIN salah. Sisa percobaan: ${MAX_ATTEMPTS - newCount}` }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null }
  })

  await setSession({ id: user.id, nama: user.nama, peran: user.peran })
  return { success: true }
}

export async function logoutUser() {
  await clearSession()
  redirect("/login")
}

export async function verifyAndUpdatePin(pinLama: string, pinBaru: string) {
  const session = await requireRole(["MANAJER"])
  if (!/^\d{4,6}$/.test(pinLama)) return { error: 'PIN lama harus 4–6 digit.' }
  if (!/^\d{4,6}$/.test(pinBaru)) return { error: 'PIN baru harus 4–6 digit.' }
  let matchedManagerId: string
  try {
    matchedManagerId = await verifyManagerPin(pinLama)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Verifikasi PIN gagal.' }
  }
  if (matchedManagerId !== session.user.id) return { error: 'PIN lama salah.' }

  const hashedNew = await bcrypt.hash(pinBaru, 10)
  await prisma.user.update({
    where: { id: matchedManagerId },
    data: { pin: hashedNew, failedAttempts: 0, lockedUntil: null }
  })
  revalidatePath('/settings')
  return { success: true }
}

export async function getEndOfDayReport(tanggal: string) {
  await requireRole(["MANAJER"])
  const start = getStartOfDayWIB(tanggal)
  const end = getEndOfDayWIB(tanggal)

  const [bills, voidItems, compItems, shifts, auditLogs] = await Promise.all([
    prisma.bill.findMany({
      where: { status: 'LUNAS', waktuTutup: { gte: start, lte: end } },
      include: { billItems: true, kasir: true, sofa: true, payments: true }
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
  const totalPembulatan = bills.reduce((s, b) => s + b.pembulatan, 0)
  const totalDiskon = bills.reduce((s, b) => s + b.diskon, 0)
  const totalVoidNominal = voidItems.reduce((s, i) => s + i.harga * i.qty, 0)
  const totalCompNominal = compItems.reduce((s, i) => s + i.harga * i.qty, 0)
  const openingCash = shifts.reduce((s, shift) => s + (shift.kasAwal || 0), 0)
  const expenseCash = shifts.reduce((s, shift) => s + (shift.pengeluaran || 0), 0)

  const cashSales = bills.reduce((sum, bill) => sum + computeShiftCash(0, 0, [bill]).penjualanTunai, 0)
  const nonCashSales = totalPendapatan - cashSales
  const expectedCash = openingCash + cashSales - expenseCash
  const hasCashCounts = shifts.length > 0 && shifts.every(shift => shift.kasHitung !== null)
  const actualClosingCash = shifts.reduce((sum, shift) => sum + (shift.kasHitung ?? 0), 0)
  const cashDifference = hasCashCounts ? actualClosingCash - expectedCash : null
  const cashTolerance = 50000
  const cashStatus = cashDifference === null
    ? 'BELUM_DITUTUP'
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
    const paymentBreakdown = bill.payments.length > 0
      ? bill.payments.map(payment => ({ method: payment.metode, amount: payment.jumlah }))
      : [{ method: bill.metodeBayar || 'TUNAI', amount: bill.total }]
    for (const payment of paymentBreakdown) {
      if (!byMetode[payment.method]) byMetode[payment.method] = { count: 0, total: 0 }
      byMetode[payment.method].count++
      byMetode[payment.method].total += payment.amount
    }
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
    totalPembulatan,
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
  await requireRole(["MANAJER"])
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
  await requireRole(["MANAJER"])
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

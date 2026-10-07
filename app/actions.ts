"use server"

import { prisma } from "@/lib/prisma"
import { calculateBillTotal } from "@/lib/bill"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { setSession, logout as clearSession, getSession } from "@/lib/auth"

export async function createTakeAwayOrder() {
  const session = await getSession()
  if (!session) throw new Error("Anda harus login")

  const kasirId = session.user.id
  const shift = await prisma.shift.findFirst({ where: { kasirId, waktuTutup: null } })
  const shiftId = shift ? shift.id : null

  // Calculate nomorBill (increment for today)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await prisma.bill.count({ where: { waktuBuka: { gte: todayStart } } })
  const nomorBill = todayCount + 1

  const bill = await prisma.bill.create({
    data: {
      tipe: "TAKE_AWAY",
      status: "TERBUKA",
      kasirId,
      shiftId,
      nomorBill
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

export async function createOrGetActiveBill(sofaId: string) {
  // Check if sofa has an open bill
  let bill = await prisma.bill.findFirst({
    where: { sofaId, status: "TERBUKA" },
    include: { billItems: true }
  })

  if (!bill) {
    const session = await getSession()
    const kasirId = session ? session.user.id : undefined
    let shiftId = undefined
    
    if (kasirId) {
      const shift = await prisma.shift.findFirst({ where: { kasirId, waktuTutup: null } })
      if (shift) shiftId = shift.id
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await prisma.bill.count({ where: { waktuBuka: { gte: todayStart } } })
    const nomorBill = todayCount + 1

    // Open new bill
    bill = await prisma.bill.create({
      data: {
        sofaId,
        tipe: "DINE_IN",
        status: "TERBUKA",
        kasirId,
        shiftId,
        nomorBill
      },
      include: { billItems: true }
    })
    
    // Update sofa status
    await prisma.sofa.update({
      where: { id: sofaId },
      data: { status: "TERISI" }
    })
  }

  return bill
}

export async function cleanupEmptyBills() {
  const emptyBills = await prisma.bill.findMany({
    where: { 
      status: "TERBUKA",
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
  const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } })
  if (!menuItem) throw new Error("Menu item not found")
  if (!menuItem.tersedia) throw new Error("Menu item habis")

  // Check Happy Hour
  const settings = await prisma.setting.findMany()
  const getSetting = (k: string, fb: string) => settings.find(s => s.kunci === k)?.nilai || fb
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

  await prisma.billItem.create({
    data: {
      billId,
      menuItemId,
      namaItem: isHhApplied ? `${menuItem.nama} (HH -${hhDiskon}%)` : menuItem.nama,
      harga: hargaFinal,
      qty,
      catatan,
      status: "DIKIRIM"
    }
  })

  await calculateBillTotal(billId)
  revalidatePath(`/`)
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

export async function cancelBill(billId: string, alasan: string, pin: string) {
  const session = await getSession()
  const pinManajer = await prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } })

  let pinValid = false
  if (pinManajer) {
    try {
      pinValid = await bcrypt.compare(pin, pinManajer.nilai)
    } catch {
      pinValid = pin === pinManajer.nilai
    }
  } else {
    pinValid = pin === '123456'
  }
  if (!pinValid) throw new Error('PIN Manajer salah')

  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) throw new Error('Bill not found')

  // Cancel bill
  await prisma.bill.update({
    where: { id: billId },
    data: { 
      status: "BATAL",
      waktuTutup: new Date()
    }
  })

  // Reset Sofa jika ada
  if (bill.sofaId) {
    await prisma.sofa.update({
      where: { id: bill.sofaId },
      data: { status: "KOSONG" }
    })
    revalidatePath(`/sofa/${bill.sofaId}`)
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'CANCEL_BILL',
      entitas: 'Bill',
      detail: JSON.stringify({ billId, alasan, otorisasi: session?.user?.nama })
    }
  })

  revalidatePath(`/`)
  revalidatePath(`/open-order`)
  redirect("/")
}

export async function closeBill(billId: string, metodeBayar: string) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) return

  // Simpan snapshot tarif saat bill ditutup
  const { getSettings } = await import('@/lib/bill')
  const settings = await getSettings()

  // Mark bill as LUNAS
  await prisma.bill.update({
    where: { id: billId },
    data: { 
      status: "LUNAS",
      waktuTutup: new Date(),
      metodeBayar 
    }
  })

  // Reset Sofa jika ada
  if (bill.sofaId) {
    await prisma.sofa.update({
      where: { id: bill.sofaId },
      data: { status: "KOSONG" }
    })
    revalidatePath(`/sofa/${bill.sofaId}`)
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: bill.kasirId || null,
      aksi: 'CLOSE_BILL',
      entitas: 'Bill',
      detail: JSON.stringify({ billId, metodeBayar, total: bill.total, pajak: settings.pajak, serviceCharge: settings.serviceCharge })
    }
  })

  revalidatePath(`/`)
  revalidatePath(`/open-order`)
}

export async function returnItem(itemId: string, alasan: string) {
  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')
  if (item.diretur) throw new Error('Item sudah diretur')

  await prisma.billItem.update({
    where: { id: itemId },
    data: { diretur: true }
  })
  await calculateBillTotal(item.billId)

  const session = await getSession()
  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'RETURN_ITEM',
      entitas: 'BillItem',
      detail: JSON.stringify({ itemId, billId: item.billId, namaItem: item.namaItem, alasan })
    }
  })
  revalidatePath(`/`)
}

export async function voidItem(itemId: string, alasan: string, pin: string) {
  const session = await getSession()
  const pinManajer = await prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } })
  
  // Support both hashed (new) and plain (legacy) PIN
  let pinValid = false
  if (pinManajer) {
    try {
      pinValid = await bcrypt.compare(pin, pinManajer.nilai)
    } catch {
      pinValid = pin === pinManajer.nilai
    }
  } else {
    pinValid = pin === '123456'
  }
  if (!pinValid) throw new Error('PIN Manajer salah')

  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')

  await prisma.billItem.update({
    where: { id: itemId },
    data: { isVoid: true, alasanVoidComp: alasan, otorisasiOleh: session?.user?.nama || 'MANAJER' }
  })
  await calculateBillTotal(item.billId)

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'VOID_ITEM',
      entitas: 'BillItem',
      detail: JSON.stringify({ itemId, billId: item.billId, namaItem: item.namaItem, alasan, otorisasi: session?.user?.nama })
    }
  })
  revalidatePath(`/`)
}

export async function compItem(itemId: string, alasan: string, pin: string) {
  const session = await getSession()
  const pinManajer = await prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } })

  let pinValid = false
  if (pinManajer) {
    try {
      pinValid = await bcrypt.compare(pin, pinManajer.nilai)
    } catch {
      pinValid = pin === pinManajer.nilai
    }
  } else {
    pinValid = pin === '123456'
  }
  if (!pinValid) throw new Error('PIN Manajer salah')

  const item = await prisma.billItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error('Item not found')

  await prisma.billItem.update({
    where: { id: itemId },
    data: { isComp: true, alasanVoidComp: alasan, otorisasiOleh: session?.user?.nama || 'MANAJER' }
  })
  await calculateBillTotal(item.billId)

  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || null,
      aksi: 'COMP_ITEM',
      entitas: 'BillItem',
      detail: JSON.stringify({ itemId, billId: item.billId, namaItem: item.namaItem, alasan, otorisasi: session?.user?.nama })
    }
  })
  revalidatePath(`/`)
}

export async function toggleMenuAvailability(menuItemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } })
  if (!item) throw new Error('Menu not found')

  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { tersedia: !item.tersedia }
  })

  revalidatePath(`/menu`)
  revalidatePath(`/`)
}

export async function addMenuItem(nama: string, harga: number, kategori: "MAKANAN" | "MINUMAN") {
  await prisma.menuItem.create({ data: { nama, harga, kategori } })
  revalidatePath('/menu')
  revalidatePath('/')
}

export async function editMenuItem(id: string, nama: string, harga: number, kategori: "MAKANAN" | "MINUMAN") {
  await prisma.menuItem.update({ where: { id }, data: { nama, harga, kategori } })
  revalidatePath('/menu')
  revalidatePath('/')
}

export async function deleteMenuItem(id: string) {
  try {
    await prisma.menuItem.delete({ where: { id } })
  } catch (e) {
    throw new Error('Menu tidak bisa dihapus karena sudah ada di riwayat pesanan. Silakan ubah statusnya menjadi Habis.')
  }
  revalidatePath('/menu')
  revalidatePath('/')
}

export async function addSofa(nama: string, kapasitas: number) {
  await prisma.sofa.create({ data: { nama, kapasitas } })
  revalidatePath('/sofas')
  revalidatePath('/')
}

export async function editSofa(id: string, nama: string, kapasitas: number) {
  await prisma.sofa.update({ where: { id }, data: { nama, kapasitas } })
  revalidatePath('/sofas')
  revalidatePath('/')
}

export async function deleteSofa(id: string) {
  try {
    await prisma.sofa.delete({ where: { id } })
  } catch (e) {
    throw new Error('Sofa tidak bisa dihapus karena memiliki riwayat tagihan. Anda dapat mengganti namanya saja (misal: "GUDANG").')
  }
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
  await prisma.sofa.update({
    where: { id: sofaId },
    data: { status }
  })
  revalidatePath(`/`)
  revalidatePath(`/sofa/${sofaId}`)
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

export async function closeShift(shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) throw new Error('Shift not found')

  // Hitung total penjualan selama shift
  const bills = await prisma.bill.findMany({
    where: {
      status: 'LUNAS',
      waktuTutup: { gte: shift.waktuBuka }
    }
  })
  const totalPenjualan = bills.reduce((acc, b) => acc + b.total, 0)
  
  // Hitung kas akhir riil
  const kasAkhir = shift.kasAwal + totalPenjualan - shift.pengeluaran

  await prisma.shift.update({
    where: { id: shiftId },
    data: {
      waktuTutup: new Date(),
      kasAkhir,
      totalPenjualan
    }
  })

  revalidatePath(`/shift`)
}

export async function catatPengeluaran(shiftId: string, jumlah: number, catatan: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) throw new Error('Shift not found')

  await prisma.shift.update({
    where: { id: shiftId },
    data: { 
      pengeluaran: shift.pengeluaran + jumlah,
      catatanPengeluaran: shift.catatanPengeluaran ? `${shift.catatanPengeluaran} | ${catatan}` : catatan 
    }
  })
  revalidatePath(`/shift`)
}

export async function createReservasi(sofaId: string, nama: string, jam: string, jumlahOrang: number, deposit?: number) {
  await prisma.reservasi.create({
    data: {
      sofaId,
      nama,
      jam: new Date(jam),
      jumlahOrang,
      deposit: deposit || null,
      status: 'PENDING'
    }
  })
  revalidatePath(`/reservasi`)
}

export async function updateReservasiStatus(id: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
  await prisma.reservasi.update({
    where: { id },
    data: { status }
  })
  revalidatePath(`/reservasi`)
}

export async function updateSetting(kunci: string, nilai: string) {
  // If updating PIN_MANAJER, hash it first
  let finalNilai = nilai
  if (kunci === 'PIN_MANAJER') {
    finalNilai = await bcrypt.hash(nilai, 10)
  }
  await prisma.setting.upsert({
    where: { kunci },
    update: { nilai: finalNilai },
    create: { kunci, nilai: finalNilai }
  })
  revalidatePath(`/settings`)
}

export async function addUser(nama: string, peran: string, pin: string) {
  const hashedPin = await bcrypt.hash(pin, 10)
  await prisma.user.create({ data: { nama, peran: peran as any, pin: hashedPin } })
  revalidatePath('/staf')
}

export async function editUser(id: string, nama: string, peran: string, pin?: string) {
  const data: any = { nama, peran: peran as any }
  if (pin) {
    data.pin = await bcrypt.hash(pin, 10)
  }
  await prisma.user.update({ where: { id }, data })
  revalidatePath('/staf')
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } })
  } catch (e) {
    throw new Error('Staf tidak bisa dihapus karena memiliki riwayat shift atau transaksi. Anda tetap bisa mengganti namanya.')
  }
  revalidatePath('/staf')
}

export async function loginWithPin(pin: string) {
  // Find user by PIN
  // Note: Since users log in with PIN, we can either check all users and verify hash, 
  // or use a simpler approach. Since we only have a few users, we can fetch all and check.
  const users = await prisma.user.findMany()
  let loggedInUser = null

  for (const u of users) {
    if (u.pin && await bcrypt.compare(pin, u.pin)) {
      loggedInUser = u
      break
    }
  }

  if (!loggedInUser) {
    return { error: "PIN salah atau tidak ditemukan" }
  }

  await setSession({
    id: loggedInUser.id,
    nama: loggedInUser.nama,
    peran: loggedInUser.peran
  })
  
  return { success: true }
}

export async function logoutUser() {
  await clearSession()
  redirect("/login")
}

export async function verifyAndUpdatePin(pinLama: string, pinBaru: string) {
  const pinManajer = await prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } })
  
  let pinLamaValid = false
  if (pinManajer) {
    try {
      pinLamaValid = await bcrypt.compare(pinLama, pinManajer.nilai)
    } catch {
      // fallback for legacy plain text
      pinLamaValid = pinLama === pinManajer.nilai
    }
  } else {
    pinLamaValid = pinLama === '123456'
  }

  if (!pinLamaValid) return { error: 'PIN lama salah' }
  if (pinBaru.length < 4) return { error: 'PIN baru minimal 4 digit' }

  const hashedNew = await bcrypt.hash(pinBaru, 10)
  await prisma.setting.upsert({
    where: { kunci: 'PIN_MANAJER' },
    update: { nilai: hashedNew },
    create: { kunci: 'PIN_MANAJER', nilai: hashedNew }
  })
  revalidatePath('/settings')
  return { success: true }
}

export async function getEndOfDayReport(tanggal: string) {
  const start = new Date(tanggal)
  start.setHours(0, 0, 0, 0)
  const end = new Date(tanggal)
  end.setHours(23, 59, 59, 999)

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
      include: { kasir: true }
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

  const byMetode: Record<string, { count: number; total: number }> = {}
  for (const bill of bills) {
    const m = bill.metodeBayar || 'TUNAI'
    if (!byMetode[m]) byMetode[m] = { count: 0, total: 0 }
    byMetode[m].count++
    byMetode[m].total += bill.total
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
    voidItems,
    compItems,
    byMetode,
    shifts,
    auditLogs
  }
}

export async function searchRiwayatBill(query: string) {
  if (!query) return []
  
  // check if query is a number (for nomorBill)
  const isNumber = !isNaN(Number(query))

  const whereClause: any = {
    status: 'LUNAS'
  }

  if (isNumber) {
    whereClause.nomorBill = Number(query)
  } else {
    // If string, we might want to search by ID or customer name (not implemented, but id is string)
    whereClause.id = { contains: query }
  }

  const bills = await prisma.bill.findMany({
    where: whereClause,
    include: {
      kasir: true,
      sofa: true
    },
    orderBy: { waktuTutup: 'desc' },
    take: 20
  })

  return bills
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

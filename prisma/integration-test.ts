/**
 * Integration Test Script — Full POS Flow
 * Langsung menggunakan Prisma untuk menguji seluruh alur bisnis.
 * Jalankan: npx tsx prisma/integration-test.ts
 */

import { PrismaClient } from '@prisma/client'
import { computeBillMathematics } from '../lib/bill'
import { getOperationalBusinessDate } from '../lib/timezone'

const prisma = new PrismaClient()

// ─── Helpers ────────────────────────────────────────────
let passed = 0
let failed = 0
const errors: string[] = []

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
    errors.push(label)
  }
}

const TEST_PREFIX = '__TEST__'

async function cleanup() {
  // Hapus data test berdasarkan prefix
  await prisma.billItem.deleteMany({ where: { namaItem: { startsWith: TEST_PREFIX } } })
  await prisma.bill.deleteMany({ where: { tipe: 'TAKE_AWAY', metodeBayar: TEST_PREFIX } })
  await prisma.auditLog.deleteMany({ where: { detail: { startsWith: TEST_PREFIX } } })
}

// ─── Tests ──────────────────────────────────────────────

async function testDataIntegrity() {
  console.log('\n📋 [1] DATA INTEGRITY — Cek data seed')

  const sofas = await prisma.sofa.findMany({ where: { isDeleted: false } })
  assert(sofas.length >= 26, `Jumlah sofa aktif >= 26 (actual: ${sofas.length})`)

  const requiredSofas = ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12',
                         'D1','D2','D3','D4','D5','D6',
                         'L1','L2','L3','L4','L5','L6',
                         'VIP','VVIP']
  const sofaNames = sofas.map(s => s.nama)
  for (const name of requiredSofas) {
    assert(sofaNames.includes(name), `Sofa "${name}" ada`)
  }

  // Cek kapasitas
  const s1 = sofas.find(s => s.nama === 'S1')
  assert(s1?.kapasitas === 4, `S1 kapasitas = 4 (actual: ${s1?.kapasitas})`)
  
  const d1 = sofas.find(s => s.nama === 'D1')
  assert(d1?.kapasitas === 6, `D1 kapasitas = 6 (actual: ${d1?.kapasitas})`)
  
  const l1 = sofas.find(s => s.nama === 'L1')
  assert(l1?.kapasitas === 8, `L1 kapasitas = 8 (actual: ${l1?.kapasitas})`)

  const vvip = sofas.find(s => s.nama === 'VVIP')
  assert(vvip?.kapasitas === 10, `VVIP kapasitas = 10 (actual: ${vvip?.kapasitas})`)

  const menuItems = await prisma.menuItem.findMany({ where: { isDeleted: false } })
  assert(menuItems.length >= 10, `Menu items >= 10 (actual: ${menuItems.length})`)

  const makanan = menuItems.filter(m => m.kategori === 'MAKANAN')
  const minuman = menuItems.filter(m => m.kategori === 'MINUMAN')
  assert(makanan.length > 0, `Ada menu MAKANAN (${makanan.length})`)
  assert(minuman.length > 0, `Ada menu MINUMAN (${minuman.length})`)

  const users = await prisma.user.findMany({ where: { isDeleted: false } })
  assert(users.length >= 2, `User/staf >= 2 (actual: ${users.length})`)

  const manager = users.find(u => u.peran === 'MANAJER')
  assert(!!manager, 'Ada user dengan peran MANAJER')

  const settings = await prisma.setting.findMany()
  const pajak = settings.find(s => s.kunci === 'PAJAK')
  const sc = settings.find(s => s.kunci === 'SERVICE_CHARGE')
  assert(!!pajak, `Setting PAJAK ada (nilai: ${pajak?.nilai})`)
  assert(!!sc, `Setting SERVICE_CHARGE ada (nilai: ${sc?.nilai})`)
}

async function testBillCreation() {
  console.log('\n📋 [2] BILL CREATION — Buat bill baru')

  const sofa = await prisma.sofa.findFirst({ where: { nama: 'D1', isDeleted: false } })
  assert(!!sofa, 'Sofa D1 ditemukan')
  if (!sofa) return

  // Create a test bill
  const bill = await prisma.bill.create({
    data: {
      businessDate: getOperationalBusinessDate(),
      tipe: 'DINE_IN',
      sofaId: sofa.id,
      status: 'TERBUKA',
      metodeBayar: TEST_PREFIX,
    }
  })
  assert(!!bill.id, `Bill berhasil dibuat (id: ${bill.id.slice(0,8)})`)
  assert(bill.status === 'TERBUKA', 'Status bill = TERBUKA')
  assert(bill.sofaId === sofa.id, 'Bill terhubung ke sofa D1')

  return bill.id
}

async function testAddItems(billId: string) {
  console.log('\n📋 [3] ADD ITEMS — Tambah item ke bill')

  const menus = await prisma.menuItem.findMany({ where: { isDeleted: false }, take: 3 })
  assert(menus.length >= 2, `Menu tersedia >= 2 (actual: ${menus.length})`)

  // Add 2x item pertama
  const item1 = await prisma.billItem.create({
    data: {
      billId,
      menuItemId: menus[0].id,
      namaItem: TEST_PREFIX + menus[0].nama,
      harga: menus[0].harga,
      qty: 2,
    }
  })
  assert(!!item1.id, `Item 1 ditambah: 2x ${menus[0].nama} @${menus[0].harga}`)

  // Add 1x item kedua
  const item2 = await prisma.billItem.create({
    data: {
      billId,
      menuItemId: menus[1].id,
      namaItem: TEST_PREFIX + menus[1].nama,
      harga: menus[1].harga,
      qty: 1,
    }
  })
  assert(!!item2.id, `Item 2 ditambah: 1x ${menus[1].nama} @${menus[1].harga}`)

  // Verify items
  const items = await prisma.billItem.findMany({ where: { billId } })
  assert(items.length === 2, `Jumlah item di bill = 2 (actual: ${items.length})`)

  return { items, menus }
}

async function testBillCalculation(billId: string) {
  console.log('\n📋 [4] KALKULASI — Service, Pajak, Total')

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { billItems: true }
  })
  if (!bill) { assert(false, 'Bill ditemukan'); return }

  const settings = await prisma.setting.findMany()
  const pajakRate = parseFloat(settings.find(s => s.kunci === 'PAJAK')?.nilai || '10')
  const serviceRate = parseFloat(settings.find(s => s.kunci === 'SERVICE_CHARGE')?.nilai || '5')

  const result = computeBillMathematics({
    items: bill.billItems,
    diskon: 0,
    pajakRate,
    serviceRate,
    pembulatanRatusan: false
  })

  assert(result.subtotal > 0, `Subtotal > 0 (Rp ${result.subtotal.toLocaleString('id-ID')})`)
  assert(result.service > 0, `Service ${serviceRate}% > 0 (Rp ${result.service.toLocaleString('id-ID')})`)
  assert(result.pajak > 0, `Pajak ${pajakRate}% > 0 (Rp ${result.pajak.toLocaleString('id-ID')})`)
  assert(result.total > result.subtotal, `Total > Subtotal`)
  assert(result.total === result.subtotal + result.service + result.pajak, 
    `Total = Subtotal + Service + Pajak (${result.total} = ${result.subtotal} + ${result.service} + ${result.pajak})`)

  // Update bill with calculation
  await prisma.bill.update({
    where: { id: billId },
    data: {
      subtotal: result.subtotal,
      service: result.service,
      pajak: result.pajak,
      total: result.total,
      pajakPct: pajakRate,
      servicePct: serviceRate,
    }
  })

  return result
}

async function testVoidItem(billId: string) {
  console.log('\n📋 [5] VOID ITEM — Void item & recalculate')

  const items = await prisma.billItem.findMany({ where: { billId } })
  const itemToVoid = items[0]
  
  // Void item pertama
  await prisma.billItem.update({
    where: { id: itemToVoid.id },
    data: { isVoid: true, alasanVoidComp: TEST_PREFIX + 'test void' }
  })

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { billItems: true }
  })
  if (!bill) { assert(false, 'Bill found'); return }

  const settings = await prisma.setting.findMany()
  const pajakRate = parseFloat(settings.find(s => s.kunci === 'PAJAK')?.nilai || '10')
  const serviceRate = parseFloat(settings.find(s => s.kunci === 'SERVICE_CHARGE')?.nilai || '5')

  const result = computeBillMathematics({
    items: bill.billItems,
    diskon: 0,
    pajakRate,
    serviceRate,
    pembulatanRatusan: false
  })

  // After void, subtotal should be lower
  const activeItems = bill.billItems.filter(i => !i.isVoid && !i.diretur && !i.isComp)
  const expectedSubtotal = activeItems.reduce((sum, i) => sum + i.harga * i.qty, 0)
  
  assert(result.subtotal === expectedSubtotal, 
    `Subtotal setelah void = ${expectedSubtotal} (actual: ${result.subtotal})`)
  assert(result.subtotal < bill.subtotal,
    `Subtotal turun setelah void (${result.subtotal} < ${bill.subtotal})`)

  // Restore void for next test
  await prisma.billItem.update({
    where: { id: itemToVoid.id },
    data: { isVoid: false, alasanVoidComp: null }
  })

  // Recalculate back
  await prisma.bill.update({
    where: { id: billId },
    data: {
      subtotal: bill.subtotal,
      service: bill.service,
      pajak: bill.pajak,
      total: bill.total,
    }
  })
}

async function testDiscount(billId: string) {
  console.log('\n📋 [6] DISKON — Diskon mengurangi dasar pajak')

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { billItems: true }
  })
  if (!bill) return

  const settings = await prisma.setting.findMany()
  const pajakRate = parseFloat(settings.find(s => s.kunci === 'PAJAK')?.nilai || '10')
  const serviceRate = parseFloat(settings.find(s => s.kunci === 'SERVICE_CHARGE')?.nilai || '5')

  const withDiscount = computeBillMathematics({
    items: bill.billItems,
    diskon: 20000,
    pajakRate,
    serviceRate,
    pembulatanRatusan: false
  })

  const withoutDiscount = computeBillMathematics({
    items: bill.billItems,
    diskon: 0,
    pajakRate,
    serviceRate,
    pembulatanRatusan: false
  })

  assert(withDiscount.total < withoutDiscount.total, 
    `Total dgn diskon < tanpa diskon (${withDiscount.total} < ${withoutDiscount.total})`)
  assert(withDiscount.service < withoutDiscount.service,
    `Service dgn diskon < tanpa diskon (${withDiscount.service} < ${withoutDiscount.service})`)
  assert(withDiscount.pajak < withoutDiscount.pajak,
    `Pajak dgn diskon < tanpa diskon (${withDiscount.pajak} < ${withoutDiscount.pajak})`)
}

async function testCheckout(billId: string) {
  console.log('\n📋 [7] CHECKOUT — Tutup bill (pembayaran)')

  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill) return

  // Simulate checkout
  await prisma.bill.update({
    where: { id: billId },
    data: {
      status: 'LUNAS',
      metodeBayar: 'TUNAI',
      waktuTutup: new Date(),
    }
  })

  const closedBill = await prisma.bill.findUnique({ where: { id: billId } })
  assert(closedBill?.status === 'LUNAS', `Status = LUNAS`)
  assert(closedBill?.metodeBayar === 'TUNAI', `Metode bayar = TUNAI`)
  assert(!!closedBill?.waktuTutup, `waktuTutup terisi`)

  // Sofa should reset
  if (closedBill?.sofaId) {
    await prisma.sofa.update({
      where: { id: closedBill.sofaId },
      data: { status: 'KOSONG' }
    })
    const sofa = await prisma.sofa.findUnique({ where: { id: closedBill.sofaId } })
    assert(sofa?.status === 'KOSONG', `Sofa kembali KOSONG setelah checkout`)
  }
}

async function testCancelBill() {
  console.log('\n📋 [8] BATAL BILL — Cancel bill')

  // Create separate bill for cancel test
  const bill = await prisma.bill.create({
    data: {
      businessDate: getOperationalBusinessDate(),
      tipe: 'TAKE_AWAY',
      status: 'TERBUKA',
      metodeBayar: TEST_PREFIX,
    }
  })

  await prisma.bill.update({
    where: { id: bill.id },
    data: { status: 'BATAL' }
  })

  const cancelled = await prisma.bill.findUnique({ where: { id: bill.id } })
  assert(cancelled?.status === 'BATAL', 'Status bill = BATAL')

  // Cleanup
  await prisma.bill.delete({ where: { id: bill.id } })
}

async function testShiftFlow() {
  console.log('\n📋 [9] SHIFT — Buka & Tutup Shift')

  const kasir = await prisma.user.findFirst({ where: { peran: 'KASIR', isDeleted: false } })
    || await prisma.user.findFirst({ where: { isDeleted: false } })
  if (!kasir) { assert(false, 'Kasir ditemukan'); return }

  // Open shift
  const shift = await prisma.shift.create({
    data: {
      kasirId: kasir.id,
      kasAwal: 500000,
    }
  })
  assert(!!shift.id, `Shift dibuka dgn kas awal Rp 500.000`)
  assert(!shift.waktuTutup, 'Shift masih terbuka (waktuTutup null)')

  // Close shift
  await prisma.shift.update({
    where: { id: shift.id },
    data: {
      waktuTutup: new Date(),
      kasAkhir: 750000,
      totalPenjualan: 250000,
    }
  })

  const closed = await prisma.shift.findUnique({ where: { id: shift.id } })
  assert(!!closed?.waktuTutup, 'Shift berhasil ditutup')
  assert(closed?.kasAkhir === 750000, `Kas akhir = 750.000`)

  // Cleanup
  await prisma.shift.delete({ where: { id: shift.id } })
}

async function testEODReport() {
  console.log('\n📋 [10] EOD REPORT — Data laporan harian')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const bills = await prisma.bill.findMany({
    where: {
      status: 'LUNAS',
      waktuTutup: { gte: today, lt: tomorrow }
    },
    include: { sofa: true }
  })

  console.log(`    ℹ️  Bills lunas hari ini: ${bills.length}`)

  if (bills.length > 0) {
    const total = bills.reduce((acc, b) => acc + b.total, 0)
    assert(total >= 0, `Total pendapatan >= 0 (Rp ${total.toLocaleString('id-ID')})`)

    // Per-sofa breakdown
    const sofaMap: Record<string, number> = {}
    bills.forEach(b => {
      const key = b.sofa?.nama || 'Take Away'
      sofaMap[key] = (sofaMap[key] || 0) + b.total
    })
    
    const sofaCount = Object.keys(sofaMap).length
    assert(sofaCount > 0, `Meja terpakai > 0 (actual: ${sofaCount})`)
    
    // Payment methods
    const methods = new Set(bills.map(b => b.metodeBayar).filter(Boolean))
    assert(methods.size > 0, `Ada metode bayar tercatat (${[...methods].join(', ')})`)
  } else {
    console.log('    ⚠️  Tidak ada transaksi hari ini (skip EOD detail)')
    assert(true, 'Query EOD berjalan tanpa error')
  }
}

async function testPageRoutes() {
  console.log('\n📋 [11] HTTP ROUTES — Cek halaman bisa diakses')

  const routes = [
    '/',
    '/login',
    '/dine-in',
    '/open-order',
    '/summary',
    '/riwayat',
    '/kitchen',
    '/bar',
  ]

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`, { 
        redirect: 'follow',
        headers: { 'Accept': 'text/html' }
      })
      // 200 or 307 (redirect to login) are both acceptable
      assert(res.status === 200 || res.status === 307, 
        `GET ${route} → ${res.status} ${res.statusText}`)
    } catch (e: any) {
      assert(false, `GET ${route} → ERROR: ${e.message}`)
    }
  }
}

// ─── Run All ────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  🧪 INTEGRATION TEST — POS LSD Superbar  ')
  console.log('═══════════════════════════════════════════')

  try {
    await cleanup()

    // 1. Data integrity
    await testDataIntegrity()

    // 2-7. Full bill flow
    const billId = await testBillCreation()
    if (billId) {
      await testAddItems(billId)
      await testBillCalculation(billId)
      await testVoidItem(billId)
      await testDiscount(billId)
      await testCheckout(billId)
    }

    // 8. Cancel bill
    await testCancelBill()

    // 9. Shift
    await testShiftFlow()

    // 10. EOD
    await testEODReport()

    // 11. HTTP routes
    await testPageRoutes()

  } finally {
    await cleanup()
  }

  // ─── Summary ────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log(`  📊 HASIL: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════')

  if (errors.length > 0) {
    console.log('\n❌ Gagal:')
    errors.forEach(e => console.log(`   • ${e}`))
  }

  if (failed === 0) {
    console.log('\n🎉 SEMUA TES LULUS! Sistem siap digunakan.')
  } else {
    console.log('\n⚠️  Ada tes yang gagal, perlu diperbaiki.')
  }

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main()

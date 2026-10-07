const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function resetDB() {
  // Hanya hapus data operasional: transaksi, log, dll
  // JANGAN hapus: User, Setting, MenuItem, Sofa
  console.log("Menghapus data transaksi...")

  // Hapus dari yang memiliki relasi ke atas
  await prisma.auditLog.deleteMany({})
  await prisma.billItem.deleteMany({})
  await prisma.reservasi.deleteMany({})
  await prisma.bill.deleteMany({})
  await prisma.shift.deleteMany({})

  // Update status sofa ke KOSONG
  await prisma.sofa.updateMany({
    data: { status: 'KOSONG' }
  })

  console.log("Semua data transaksi (Bill, BillItem, Shift, AuditLog, Reservasi) berhasil dihapus!")
  console.log("Sofa telah direset ke KOSONG.")
  console.log("User, Menu, dan Setting TETAP AMAN.")
}

resetDB()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())

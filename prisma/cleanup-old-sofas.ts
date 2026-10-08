import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Hapus sofa lama yang bukan dari layout asli
  const validNames = [
    'S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12',
    'D1','D2','D3','D4','D5','D6',
    'L1','L2','L3','L4','L5','L6',
    'VIP','VVIP'
  ]

  // Cari sofa yang namanya BUKAN dari daftar valid
  const oldSofas = await prisma.sofa.findMany({
    where: { nama: { notIn: validNames } }
  })

  if (oldSofas.length > 0) {
    console.log(`🗑️  Menghapus ${oldSofas.length} sofa lama:`, oldSofas.map(s => s.nama))
    
    // Hapus bill items terkait bill di sofa lama
    for (const sofa of oldSofas) {
      await prisma.billItem.deleteMany({
        where: { bill: { sofaId: sofa.id } }
      })
      await prisma.bill.deleteMany({
        where: { sofaId: sofa.id }
      })
      await prisma.reservasi.deleteMany({
        where: { sofaId: sofa.id }
      })
    }

    await prisma.sofa.deleteMany({
      where: { nama: { notIn: validNames } }
    })
    console.log('✅ Sofa lama berhasil dihapus.')
  } else {
    console.log('ℹ️  Tidak ada sofa lama yang perlu dihapus.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

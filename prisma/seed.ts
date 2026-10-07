import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // 1. Seed Users
  const user1 = await prisma.user.create({
    data: {
      nama: 'Budi Pelayan',
      peran: 'PELAYAN',
    },
  })
  
  const user2 = await prisma.user.create({
    data: {
      nama: 'Siti Kasir',
      peran: 'KASIR',
    },
  })

  const user3 = await prisma.user.create({
    data: {
      nama: 'Joko Bartender',
      peran: 'BARTENDER',
    },
  })

  const user4 = await prisma.user.create({
    data: {
      nama: 'Agus Dapur',
      peran: 'DAPUR',
    },
  })

  const user5 = await prisma.user.create({
    data: {
      nama: 'Bos Manajer',
      peran: 'MANAJER',
    },
  })

  console.log('Users seeded')

  // 2. Seed Sofas
  const sofa1 = await prisma.sofa.create({
    data: {
      nama: 'Sofa 1',
      kapasitas: 4,
      status: 'KOSONG',
    },
  })

  const sofa2 = await prisma.sofa.create({
    data: {
      nama: 'Sofa 2',
      kapasitas: 6,
      status: 'KOSONG',
    },
  })

  const sofa3 = await prisma.sofa.create({
    data: {
      nama: 'Sofa VIP',
      kapasitas: 10,
      status: 'KOSONG',
    },
  })

  console.log('Sofas seeded')

  // 3. Seed Menu Items
  const menu1 = await prisma.menuItem.create({
    data: {
      nama: 'Nasi Goreng Spesial',
      harga: 45000,
      kategori: 'MAKANAN',
      tersedia: true,
    },
  })

  const menu2 = await prisma.menuItem.create({
    data: {
      nama: 'Spaghetti Bolognese',
      harga: 55000,
      kategori: 'MAKANAN',
      tersedia: true,
    },
  })

  const menu3 = await prisma.menuItem.create({
    data: {
      nama: 'Mojito Mint',
      harga: 35000,
      kategori: 'MINUMAN',
      tersedia: true,
    },
  })

  const menu4 = await prisma.menuItem.create({
    data: {
      nama: 'Bintang Radler',
      harga: 30000,
      kategori: 'MINUMAN',
      tersedia: true,
    },
  })

  console.log('Menu Items seeded')

  // 4. Seed Settings
  await prisma.setting.createMany({
    data: [
      { kunci: 'PAJAK', nilai: '10' },
      { kunci: 'SERVICE_CHARGE', nilai: '5' },
      { kunci: 'PEMBULATAN_RATUSAN', nilai: 'false' },
    ],
    skipDuplicates: true,
  })

  console.log('Settings seeded')

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

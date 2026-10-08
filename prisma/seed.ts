import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Memulai proses seeding database...')

  // 1. Bersihkan data lama (opsional jika database di-reset)
  // await prisma.billItem.deleteMany()
  // await prisma.bill.deleteMany()
  // await prisma.shift.deleteMany()
  // await prisma.reservasi.deleteMany()
  // await prisma.auditLog.deleteMany()
  // await prisma.menuItem.deleteMany()
  // await prisma.sofa.deleteMany()
  // await prisma.user.deleteMany()
  // await prisma.setting.deleteMany()

  // 2. Settings (Pajak 10%, Service 5%)
  await prisma.setting.upsert({
    where: { kunci: 'PAJAK' },
    update: { nilai: '10' },
    create: { kunci: 'PAJAK', nilai: '10' }
  })
  await prisma.setting.upsert({
    where: { kunci: 'SERVICE_CHARGE' },
    update: { nilai: '5' },
    create: { kunci: 'SERVICE_CHARGE', nilai: '5' }
  })
  
  // 3. Data Sofa
  const sofas = [
    // 1st Floor
    { nama: 'S1', kapasitas: 4 },
    { nama: 'S2', kapasitas: 4 },
    { nama: 'S3', kapasitas: 4 },
    { nama: 'S4', kapasitas: 4 },
    { nama: 'D1', kapasitas: 6 },
    { nama: 'D2', kapasitas: 6 },
    { nama: 'D3', kapasitas: 6 },
    { nama: 'D4', kapasitas: 6 },
    { nama: 'D5', kapasitas: 6 },
    { nama: 'D6', kapasitas: 6 },
    { nama: 'L1', kapasitas: 8 },
    { nama: 'L2', kapasitas: 8 },
    { nama: 'L3', kapasitas: 8 },
    { nama: 'L4', kapasitas: 8 },
    { nama: 'L5', kapasitas: 8 },
    { nama: 'L6', kapasitas: 8 },
    { nama: 'VIP', kapasitas: 8 },
    // 2nd Floor
    { nama: 'S5', kapasitas: 4 },
    { nama: 'S6', kapasitas: 4 },
    { nama: 'S7', kapasitas: 4 },
    { nama: 'S8', kapasitas: 4 },
    { nama: 'S9', kapasitas: 4 },
    { nama: 'S10', kapasitas: 4 },
    { nama: 'S11', kapasitas: 4 },
    { nama: 'S12', kapasitas: 4 },
    { nama: 'VVIP', kapasitas: 10 },
  ]

  for (const sofa of sofas) {
    const exists = await prisma.sofa.findFirst({ where: { nama: sofa.nama } })
    if (!exists) {
      await prisma.sofa.create({ data: sofa })
    }
  }

  // 4. Data Menu
  const menus = [
    // Minuman
    { nama: 'Bintang Radler', harga: 45000, kategori: 'MINUMAN' },
    { nama: 'Heineken (Botol)', harga: 55000, kategori: 'MINUMAN' },
    { nama: 'Guinness Stout', harga: 60000, kategori: 'MINUMAN' },
    { nama: 'Tequila Shot (Jose Cuervo)', harga: 80000, kategori: 'MINUMAN' },
    { nama: 'Vodka Tonic', harga: 95000, kategori: 'MINUMAN' },
    { nama: 'Long Island Iced Tea', harga: 135000, kategori: 'MINUMAN' },
    { nama: 'Margarita Classic', harga: 110000, kategori: 'MINUMAN' },
    { nama: 'Mineral Water (Equil)', harga: 30000, kategori: 'MINUMAN' },
    { nama: 'Coca Cola', harga: 25000, kategori: 'MINUMAN' },
    { nama: 'Sprite', harga: 25000, kategori: 'MINUMAN' },
    
    // Makanan
    { nama: 'French Fries', harga: 35000, kategori: 'MAKANAN' },
    { nama: 'Nachos Grande', harga: 65000, kategori: 'MAKANAN' },
    { nama: 'Chicken Wings (6 pcs)', harga: 55000, kategori: 'MAKANAN' },
    { nama: 'Calamari Rings', harga: 60000, kategori: 'MAKANAN' },
    { nama: 'Beef Burger & Fries', harga: 85000, kategori: 'MAKANAN' },
    { nama: 'Margherita Pizza', harga: 95000, kategori: 'MAKANAN' },
    { nama: 'Peanuts (Kacang Bawang)', harga: 25000, kategori: 'MAKANAN' },
    { nama: 'Sausage Platter', harga: 120000, kategori: 'MAKANAN' },
  ]

  for (const menu of menus) {
    const exists = await prisma.menuItem.findFirst({ where: { nama: menu.nama } })
    if (!exists) {
      await prisma.menuItem.create({
        data: {
          nama: menu.nama,
          harga: menu.harga,
          kategori: menu.kategori as any
        }
      })
    }
  }

  // 5. Data Akun Staf Default
  const defaultPin = await bcrypt.hash('123456', 10)
  const hashedManajerPin = await bcrypt.hash('999999', 10)
  
  const users = [
    { nama: 'Siska (Kasir)', peran: 'KASIR', pin: defaultPin },
    { nama: 'Agus (Kasir Malam)', peran: 'KASIR', pin: defaultPin },
    { nama: 'Budi (Dapur)', peran: 'DAPUR', pin: defaultPin },
    { nama: 'Andi (Bar)', peran: 'BARTENDER', pin: defaultPin },
    { nama: 'Sari (Pelayan)', peran: 'PELAYAN', pin: defaultPin },
    { nama: 'Bapak Manajer', peran: 'MANAJER', pin: hashedManajerPin },
  ]

  for (const user of users) {
    const exists = await prisma.user.findFirst({ where: { nama: user.nama } })
    if (!exists) {
      await prisma.user.create({
        data: {
          nama: user.nama,
          peran: user.peran as any,
          pin: user.pin
        }
      })
    }
  }

  console.log('✅ Seeding selesai! Data siap untuk Simulasi 1 Hari.')
  console.log('👉 Login Staf biasa: PIN 123456')
  console.log('👉 Login Manajer: PIN 999999')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

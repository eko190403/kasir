import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { syncMenuCatalog } from './menu-sync'

const prisma = new PrismaClient()

const defaultSettings = [
  { kunci: 'PAJAK', nilai: '0' },
  { kunci: 'SERVICE_CHARGE', nilai: '0' },
  { kunci: 'PEMBULATAN_RATUSAN', nilai: 'false' },
  { kunci: 'HAPPY_HOUR_AKTIF', nilai: 'false' },
  { kunci: 'HAPPY_HOUR_MULAI', nilai: '17:00' },
  { kunci: 'HAPPY_HOUR_SELESAI', nilai: '20:00' },
  { kunci: 'HAPPY_HOUR_DISKON', nilai: '10' },
]

const sofas = [
  { nama: 'S1', kapasitas: 4 },
  { nama: 'S2', kapasitas: 4 },
  { nama: 'S3', kapasitas: 4 },
  { nama: 'S4', kapasitas: 4 },
  { nama: 'S5', kapasitas: 4 },
  { nama: 'S6', kapasitas: 4 },
  { nama: 'S7', kapasitas: 4 },
  { nama: 'S8', kapasitas: 4 },
  { nama: 'S9', kapasitas: 4 },
  { nama: 'S10', kapasitas: 4 },
  { nama: 'S11', kapasitas: 4 },
  { nama: 'S12', kapasitas: 4 },
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
  { nama: 'VVIP', kapasitas: 10 },
]

async function ensureSettings() {
  console.log('🌱 Menyiapkan setting default...')

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { kunci: setting.kunci },
      update: { nilai: setting.nilai },
      create: { kunci: setting.kunci, nilai: setting.nilai },
    })
  }
}

async function ensureSofas() {
  console.log('🪑 Menyiapkan data meja...')

  for (const sofa of sofas) {
    const existing = await prisma.sofa.findFirst({
      where: { nama: sofa.nama },
    })

    if (existing) {
      await prisma.sofa.update({
        where: { id: existing.id },
        data: { kapasitas: sofa.kapasitas },
      })
      continue
    }

    await prisma.sofa.create({
      data: { nama: sofa.nama, kapasitas: sofa.kapasitas },
    })
  }
}

async function ensureMenuItems() {
  console.log('🍽️ Menyiapkan data menu...')
  await syncMenuCatalog(prisma)
}

async function ensureUsers() {
  console.log('👤 Menyiapkan data staf...')

  const defaultPinValue = process.env.INITIAL_STAFF_PIN
  const managerPinValue = process.env.INITIAL_MANAGER_PIN
  if (!defaultPinValue || !/^\d{4,6}$/.test(defaultPinValue)) {
    throw new Error('Set INITIAL_STAFF_PIN ke PIN acak 4–6 digit sebelum menjalankan seed.')
  }
  if (!managerPinValue || !/^\d{4,6}$/.test(managerPinValue)) {
    throw new Error('Set INITIAL_MANAGER_PIN ke PIN acak 4–6 digit sebelum menjalankan seed.')
  }
  const defaultPin = await bcrypt.hash(defaultPinValue, 10)
  const managerPin = await bcrypt.hash(managerPinValue, 10)

  const users = [
    { nama: 'Siska (Kasir)', peran: 'KASIR' as const, pin: defaultPin },
    { nama: 'Agus (Kasir Malam)', peran: 'KASIR' as const, pin: defaultPin },
    { nama: 'Budi (Dapur)', peran: 'DAPUR' as const, pin: defaultPin },
    { nama: 'Andi (Bar)', peran: 'BARTENDER' as const, pin: defaultPin },
    { nama: 'Sari (Pelayan)', peran: 'PELAYAN' as const, pin: defaultPin },
    { nama: 'Bapak Manajer', peran: 'MANAJER' as const, pin: managerPin },
  ]

  for (const user of users) {
    const existing = await prisma.user.findFirst({
      where: { nama: user.nama },
    })

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { peran: user.peran, ...(existing.pin ? {} : { pin: user.pin }) },
      })
      continue
    }

    await prisma.user.create({
      data: {
        nama: user.nama,
        peran: user.peran,
        pin: user.pin,
      },
    })
  }
}

async function main() {
  console.log('🌱 Memulai proses seeding database...')

  await ensureSettings()
  await ensureSofas()
  await ensureMenuItems()
  await ensureUsers()

  console.log('✅ Seeding selesai!')
  console.log('👉 Jalankan: npm run dev')
}

main()
  .catch((error) => {
    console.error('❌ Seeding gagal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

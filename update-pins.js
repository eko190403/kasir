const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const setting = await prisma.setting.findUnique({ where: { kunci: 'PIN_MANAJER' } })
  
  if (!setting) {
    // Create with hashed default PIN
    const hashed = await bcrypt.hash('123456', 10)
    await prisma.setting.create({ data: { kunci: 'PIN_MANAJER', nilai: hashed } })
    console.log('PIN_MANAJER created with default 123456 (hashed)')
  } else {
    // Check if already hashed (bcrypt hashes start with $2b$)
    if (setting.nilai.startsWith('$2b$') || setting.nilai.startsWith('$2a$')) {
      console.log('PIN_MANAJER sudah di-hash, skip.')
    } else {
      // Hash the plain text value
      const hashed = await bcrypt.hash(setting.nilai, 10)
      await prisma.setting.update({ where: { kunci: 'PIN_MANAJER' }, data: { nilai: hashed } })
      console.log(`PIN_MANAJER berhasil di-hash (nilai lama: ${setting.nilai})`)
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())

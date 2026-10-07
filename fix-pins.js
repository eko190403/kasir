const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  
  // Assign unique PINs
  for (const u of users) {
    let rawPin = '123456'
    if (u.nama === 'Bos Manajer') rawPin = '999999' // Manajer PIN
    else if (u.nama === 'Siti Kasir') rawPin = '111111'
    else if (u.nama === 'Budi Pelayan') rawPin = '222222'
    else if (u.nama === 'Joko Bartender') rawPin = '333333'
    else if (u.nama === 'Agus Dapur') rawPin = '444444'
    else rawPin = String(Math.floor(100000 + Math.random() * 900000)) // Random 6 digit if unknown

    const hashed = await bcrypt.hash(rawPin, 10)
    await prisma.user.update({
      where: { id: u.id },
      data: { pin: hashed }
    })
    console.log(`PIN untuk ${u.nama} (${u.peran}) diubah menjadi: ${rawPin}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())

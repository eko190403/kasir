import { prisma } from "../lib/prisma"
import { syncMenuCatalog } from "./menu-sync"

async function main() {
  const result = await syncMenuCatalog(prisma)
  console.log(JSON.stringify({ ...result, pajak: 0, serviceCharge: 0 }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import type { Prisma, PrismaClient } from "@prisma/client"
import { menuCatalog } from "../lib/menu-catalog"

export async function syncMenuCatalog(prisma: PrismaClient) {
  const names = new Set(menuCatalog.map(item => item.nama.toLocaleLowerCase("id-ID")))
  if (names.size !== menuCatalog.length) {
    throw new Error("Katalog menu memiliki nama item duplikat.")
  }
  for (const item of menuCatalog) {
    if (!Number.isSafeInteger(item.harga) || item.harga <= 0) {
      throw new Error(`Harga menu ${item.nama} tidak valid.`)
    }
  }

  return prisma.$transaction(async tx => {
    const existingItems = await tx.menuItem.findMany({
      orderBy: { id: "asc" },
      select: { id: true, nama: true }
    })
    const existingByName = new Map<string, string[]>()
    for (const item of existingItems) {
      const key = item.nama.trim().toLocaleLowerCase("id-ID")
      existingByName.set(key, [...(existingByName.get(key) ?? []), item.id])
    }

    await tx.menuItem.updateMany({
      where: { isDeleted: false },
      data: { isDeleted: true }
    })

    let updated = 0
    const itemsToCreate: Prisma.MenuItemCreateManyInput[] = []
    for (const item of menuCatalog) {
      const key = item.nama.trim().toLocaleLowerCase("id-ID")
      const existingIds = existingByName.get(key) ?? []
      const existingId = existingIds.shift()
      if (existingId) {
        await tx.menuItem.update({
          where: { id: existingId },
          data: {
            nama: item.nama,
            harga: item.harga,
            kategori: item.kategori,
            isDeleted: false
          }
        })
        updated++
      } else {
        itemsToCreate.push({
          nama: item.nama,
          harga: item.harga,
          kategori: item.kategori
        })
      }
    }
    const { count: created } = await tx.menuItem.createMany({ data: itemsToCreate })

    const deactivated = await tx.menuItem.count({ where: { isDeleted: true } })
    await tx.auditLog.create({
      data: {
        aksi: "MENU_CATALOG_SYNC",
        entitas: "MenuItem",
        detail: {
          source: "Menu LSD Oktober.pdf",
          activeItems: menuCatalog.length,
          updated,
          created,
          deactivated
        }
      }
    })
    for (const [kunci, nilai] of [
      ["PAJAK", "0"],
      ["SERVICE_CHARGE", "0"],
      ["HAPPY_HOUR_AKTIF", "false"]
    ]) {
      await tx.setting.upsert({
        where: { kunci },
        update: { nilai },
        create: { kunci, nilai }
      })
    }

    return { activeItems: menuCatalog.length, updated, created, deactivated }
  })
}

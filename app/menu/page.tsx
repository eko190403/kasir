import { prisma } from "@/lib/prisma"
import MenuClient from "@/components/MenuClient"
import { BookOpen } from "lucide-react"

export const instant = false

export default async function MenuPage() {
  const menuItems = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    orderBy: [{ kategori: 'asc' }, { nama: 'asc' }]
  })

  const totalTersedia = menuItems.filter((item) => item.tersedia).length
  const totalHabis = menuItems.length - totalTersedia

  return (
    <main className="container mx-auto space-y-6 p-4">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <BookOpen className="h-8 w-8 text-emerald-500" />
          Manajemen Menu
        </h1>
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-400">{totalTersedia} tersedia</span>
          <span className={totalHabis > 0 ? "text-red-400" : "text-zinc-400"}>
            {totalHabis} habis
          </span>
        </div>
      </header>

      <MenuClient menuItems={menuItems} />
    </main>
  )
}

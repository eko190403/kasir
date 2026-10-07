import { prisma } from "@/lib/prisma"
import MenuClient from "@/components/MenuClient"
import { BookOpen } from "lucide-react"

export const instant = false

export default async function MenuPage() {
  const menuItems = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    orderBy: [{ kategori: 'asc' }, { nama: 'asc' }]
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-emerald-500" />
          Manajemen Menu
        </h1>
        <span className="text-sm text-zinc-400">{menuItems.filter(m => m.tersedia).length}/{menuItems.length} tersedia</span>
      </header>
      <MenuClient menuItems={menuItems} />
    </main>
  )
}

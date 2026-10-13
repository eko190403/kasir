import { prisma } from "@/lib/prisma"
import MenuClient from "@/components/MenuClient"
import { BookOpen } from "lucide-react"
import { requirePageRole } from "@/lib/page-auth"

export const instant = false

export default async function MenuPage() {
  await requirePageRole(["MANAJER", "KASIR"])
  const menuItems = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    orderBy: [{ kategori: 'asc' }, { nama: 'asc' }]
  })

  const totalTersedia = menuItems.filter((item) => item.tersedia).length
  const totalHabis = menuItems.length - totalTersedia

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">PENGELOLAAN</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <BookOpen className="h-5 w-5 text-amber-400" />
            Menu
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Kelola daftar, harga, dan ketersediaan menu.</p>
        </div>
        <p className="text-sm tabular-nums text-zinc-400">
          <span className="text-zinc-200">{totalTersedia}</span> tersedia
          <span className="mx-2 text-zinc-700">·</span>
          <span className={totalHabis > 0 ? "text-amber-300" : "text-zinc-500"}>{totalHabis} habis</span>
        </p>
      </header>

      <MenuClient menuItems={menuItems} />
    </main>
  )
}

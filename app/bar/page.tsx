import { prisma } from "@/lib/prisma"
import RealtimeBoard from "@/components/RealtimeBoard"

export const instant = false

export default async function BarPage() {
  // Ambil semua item MINUMAN yang belum SIAP
  const items = await prisma.billItem.findMany({
    where: {
      status: { not: "SIAP" },
      menuItem: { kategori: "MINUMAN" }
    },
    orderBy: { bill: { waktuBuka: 'asc' } },
    include: { menuItem: true, bill: { include: { sofa: true } } }
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Layar Bar (Minuman)</h1>
      </header>
      <RealtimeBoard kategori="MINUMAN" initialItems={items} />
    </main>
  )
}

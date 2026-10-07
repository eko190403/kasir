import { prisma } from "@/lib/prisma"
import RealtimeBoard from "@/components/RealtimeBoard"

export const instant = false

export default async function KitchenPage() {
  // Ambil semua item MAKANAN yang belum SIAP
  const items = await prisma.billItem.findMany({
    where: {
      status: { not: "SIAP" },
      menuItem: { kategori: "MAKANAN" }
    },
    orderBy: { bill: { waktuBuka: 'asc' } },
    include: { menuItem: true, bill: { include: { sofa: true } } }
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Layar Dapur (Makanan)</h1>
      </header>
      <RealtimeBoard kategori="MAKANAN" initialItems={items} />
    </main>
  )
}

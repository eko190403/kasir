import { prisma } from "@/lib/prisma"
import RealtimeBoard from "@/components/RealtimeBoard"

export const instant = false

export default async function KitchenPage() {
  // Ambil semua item MAKANAN yang belum SIAP
  const items = await prisma.billItem.findMany({
    where: {
      status: { not: "SIAP" },
      menuItem: { kategori: "MAKANAN" },
      bill: { status: "TERBUKA" },
      isVoid: false,
      isComp: false,
      diretur: false,
    },
    orderBy: { bill: { waktuBuka: 'asc' } },
    include: { menuItem: true, bill: { include: { sofa: true } } }
  })

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <p className="mb-1 text-xs font-medium text-amber-400">OPERASIONAL · PRODUKSI</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Dapur</h1>
        <p className="mt-1 text-sm text-zinc-400">Pesanan makanan yang perlu disiapkan.</p>
      </header>
      <RealtimeBoard kategori="MAKANAN" initialItems={items} />
    </main>
  )
}

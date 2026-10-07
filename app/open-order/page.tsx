import { prisma } from "@/lib/prisma"
import { cleanupEmptyBills } from "@/app/actions"
import OpenOrderClient from "@/components/OpenOrderClient"
import { ShoppingCart } from "lucide-react"

export const instant = false

export default async function OpenOrderPage() {
  await cleanupEmptyBills()
  const openBills = await prisma.bill.findMany({
    where: { status: 'TERBUKA' },
    include: {
      sofa: true,
      billItems: true,
    },
    orderBy: { waktuBuka: 'desc' }
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-emerald-500" />
          Open Order
        </h1>
        <span className="text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
          {openBills.length} tagihan aktif
        </span>
      </header>
      <OpenOrderClient bills={openBills as any} />
    </main>
  )
}

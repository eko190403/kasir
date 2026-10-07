import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Armchair, ShoppingBag } from "lucide-react"
import { createTakeAwayOrder, cleanupEmptyBills } from "@/app/actions"

export const instant = false

export default async function DineInPage() {
  await cleanupEmptyBills()

  const sofas = await prisma.sofa.findMany({
    orderBy: { nama: 'asc' },
    include: {
      bills: {
        where: { status: 'TERBUKA' }
      }
    }
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-3xl font-bold">Daftar Sofa (Dine In)</h1>
        <div className="flex gap-4">
          <form action={createTakeAwayOrder}>
            <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition cursor-pointer flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              New Take Away
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {sofas.map(sofa => {
          const hasOpenBill = sofa.bills.length > 0
          
          let bgColor = "bg-zinc-800"
          switch(sofa.status) {
            case "KOSONG": bgColor = "bg-zinc-800"; break;
            case "TERISI": bgColor = "bg-blue-600"; break;
            case "MENUNGGU_MAKANAN": bgColor = "bg-amber-600"; break;
            case "SIAP_BAYAR": bgColor = "bg-emerald-600"; break;
          }

          return (
            <Link 
              key={sofa.id}
              href={`/sofa/${sofa.id}`}
              className={`p-6 rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-80 transition shadow-lg ${bgColor}`}
            >
              <Armchair className="w-10 h-10 mb-3 opacity-90" />
              <span className="text-xl font-bold">{sofa.nama}</span>
              <span className="text-xs opacity-80 mt-1">{sofa.kapasitas} Orang</span>
              
              <div className="mt-3 text-xs font-semibold px-2 py-1 bg-black/30 rounded-full">
                {sofa.status.replace("_", " ")}
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}

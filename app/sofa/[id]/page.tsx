import { prisma } from "@/lib/prisma"
import { createOrGetActiveBill } from "@/app/actions"
import BillClient from "@/components/BillClient"
import PindahSofaButton from "@/components/PindahSofaButton"
import SofaStatusToggle from "@/components/SofaStatusToggle"
import Link from "next/link"

export const instant = false

export default async function SofaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sofa = await prisma.sofa.findUnique({ where: { id } })
  
  if (!sofa) {
    return (
      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-500">Sofa tidak ditemukan</h1>
        <Link href="/" className="text-emerald-400 mt-4 inline-block">Kembali ke Beranda</Link>
      </main>
    )
  }

  // Ensure there is an active bill for this sofa (New Order / Open Order)
  const bill = await createOrGetActiveBill(sofa.id)

  const menuItems = await prisma.menuItem.findMany({
    orderBy: { kategori: 'asc' }
  })

  // Ambil semua sofa untuk fitur pindah
  const allSofas = await prisma.sofa.findMany({ orderBy: { nama: 'asc' } })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold">{sofa.nama}</h1>
          <p className="text-zinc-400 text-sm mt-1 mb-2">Kapasitas: {sofa.kapasitas} Orang</p>
          <SofaStatusToggle sofaId={sofa.id} currentStatus={sofa.status} />
        </div>
        <div className="flex gap-2 items-center">
          <PindahSofaButton billId={bill.id} currentSofaId={sofa.id} sofas={allSofas} />
          <Link href="/" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition h-[36px] flex items-center justify-center">
            Kembali
          </Link>
        </div>
      </header>

      <BillClient 
        billId={bill.id} 
        menuItems={menuItems}
        initialBillItems={bill.billItems}
        totals={{
          subtotal: bill.subtotal,
          diskon: bill.diskon,
          service: bill.service,
          pajak: bill.pajak,
          total: bill.total
        }}
      />
    </main>
  )
}

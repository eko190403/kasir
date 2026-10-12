import { prisma } from "@/lib/prisma"
import { createOrGetActiveBill } from "@/app/actions"
import BillClient from "@/components/BillClient"
import PindahSofaButton from "@/components/PindahSofaButton"
import SofaStatusToggle from "@/components/SofaStatusToggle"
import Link from "next/link"
import { redirect } from "next/navigation"

export const instant = false

export default async function SofaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [sofa, allSofas] = await Promise.all([
    prisma.sofa.findUnique({ where: { id } }),
    prisma.sofa.findMany({ orderBy: { nama: 'asc' } })
  ])
  
  if (!sofa) {
    return (
      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-500">Sofa tidak ditemukan</h1>
        <Link href="/" className="text-emerald-400 mt-4 inline-block">Kembali ke Beranda</Link>
      </main>
    )
  }

  // Ensure there is an active bill for this sofa (New Order / Open Order)
  let activeBill
  try {
    activeBill = await createOrGetActiveBill(sofa.id)
  } catch (error) {
    if (error instanceof Error && error.message.includes("Buka shift terlebih dahulu")) {
      redirect(`/shift?next=${encodeURIComponent(`/sofa/${sofa.id}`)}`)
    }
    throw error
  }

  const sofaStatus = await prisma.sofa.findUnique({
    where: { id: sofa.id },
    select: { status: true }
  })
  if (!sofaStatus) throw new Error("Meja tidak ditemukan atau tidak aktif.")

  const bill = await prisma.bill.findUnique({
    where: { id: activeBill.id },
    include: { billItems: true, payments: true }
  })
  if (!bill) throw new Error('Bill aktif tidak ditemukan.')

  const menuItems = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    orderBy: { kategori: 'asc' }
  })

  const depositReservasis = await prisma.reservasi.findMany({
    where: {
      sofaId: sofa.id,
      status: 'CONFIRMED',
      billId: null,
      deposit: { gt: 0 }
    },
    orderBy: { jam: 'asc' },
    select: { id: true, nama: true, jam: true, deposit: true, depositMetode: true }
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold">{sofa.nama}</h1>
          <p className="text-zinc-400 text-sm mt-1 mb-2">Kapasitas: {sofa.kapasitas} Orang</p>
          <SofaStatusToggle
            sofaId={sofa.id}
            currentStatus={sofaStatus.status}
            hasActiveBill={bill.status === "TERBUKA"}
          />
        </div>
        <div className="flex gap-2 items-center">
          <PindahSofaButton billId={bill.id} currentSofaId={sofa.id} sofas={allSofas} />
          <Link href="/" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition h-[36px] flex items-center justify-center">
            Kembali
          </Link>
        </div>
      </header>

      <BillClient
        key={bill.updatedAt.toISOString()}
        billId={bill.id} 
        menuItems={menuItems}
        initialBillItems={bill.billItems}
        initialPayments={bill.payments}
        depositReservasis={depositReservasis}
        totals={{
          subtotal: bill.subtotal,
          diskon: bill.diskon,
          service: bill.service,
          pajak: bill.pajak,
          pembulatan: bill.pembulatan,
          total: bill.total
        }}
      />
    </main>
  )
}

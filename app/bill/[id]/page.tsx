import { prisma } from "@/lib/prisma"
import BillClient from "@/components/BillClient"
import { getSession } from "@/lib/auth"
import Link from "next/link"
import { notFound } from "next/navigation"

export const instant = false

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { billItems: true, payments: true }
  })
  
  if (!bill) return notFound()

  const session = await getSession()
  const canOperatePayments = session?.user.peran === "KASIR" || session?.user.peran === "MANAJER"
  const menuItems = await prisma.menuItem.findMany({
    where: { isDeleted: false },
    orderBy: { kategori: 'asc' }
  })
  const depositReservasis = bill.status === 'TERBUKA' && bill.sofaId
    ? await prisma.reservasi.findMany({
      where: {
        sofaId: bill.sofaId,
        status: 'CONFIRMED',
        billId: null,
        deposit: { gt: 0 }
      },
      orderBy: { jam: 'asc' },
      select: { id: true, nama: true, jam: true, deposit: true, depositMetode: true }
    })
    : []

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold">Pesanan {bill.tipe.replace('_', ' ')}</h1>
          <p className="text-zinc-400 text-sm mt-1">Status: {bill.status}</p>
        </div>
        <Link href="/open-order" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition">
          Kembali
        </Link>
      </header>

      <BillClient 
        billId={bill.id} 
        canOperatePayments={canOperatePayments}
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

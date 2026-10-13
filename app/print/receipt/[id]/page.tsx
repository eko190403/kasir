import { prisma } from "@/lib/prisma"
import PrintReceiptClient from "@/components/PrintReceiptClient"
import { notFound } from "next/navigation"
import { requirePageRole } from "@/lib/page-auth"
import { canAccessBill } from "@/lib/bill-access"

export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await requirePageRole(["PELAYAN", "BARTENDER", "DAPUR", "KASIR", "MANAJER"])

  const [bill, settings] = await Promise.all([
    prisma.bill.findUnique({
      where: { id },
      include: { billItems: true, sofa: true, kasir: true, payments: { orderBy: { createdAt: 'asc' } } }
    }),
    prisma.setting.findMany()
  ])

  if (!bill || !canAccessBill(actor.peran, actor.id, bill.kasirId)) return notFound()

  const getSetting = (kunci: string, fallback: string) => settings.find(s => s.kunci === kunci)?.nilai || fallback
  const namaBar = getSetting('NAMA_BAR', 'SUPERBAR')
  const alamatBar = getSetting('ALAMAT_BAR', 'Jl. Gatot Subroto Barat No.317 Pemecutan Kaja, North Denpasar')

  return (
    <PrintReceiptClient
      bill={{
        ...bill,
        billItems: bill.billItems.filter((item) => !item.isVoid && !item.diretur && !item.isComp),
        payments: bill.payments
          .filter((payment) => payment.status === "SUDAH_BAYAR")
          .map((payment) => ({
          id: payment.id,
          metode: payment.metode,
          jumlah: payment.jumlah,
          })),
      }}
      namaBar={namaBar}
      alamatBar={alamatBar}
    />
  )
}

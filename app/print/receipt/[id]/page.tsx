import { prisma } from "@/lib/prisma"
import PrintReceiptClient from "@/components/PrintReceiptClient"

export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [bill, settings] = await Promise.all([
    prisma.bill.findUnique({
      where: { id },
      include: { billItems: true, sofa: true, kasir: true, payments: { orderBy: { createdAt: 'asc' } } }
    }),
    prisma.setting.findMany()
  ])

  if (!bill) return <div>Bill not found</div>

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

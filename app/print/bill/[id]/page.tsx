import { prisma } from "@/lib/prisma"

export const instant = false

export default async function PrintBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { billItems: true, sofa: true, kasir: true }
  })

  if (!bill) return <div>Bill not found</div>

  return (
    <div className="bg-white text-black min-h-screen p-8 font-mono text-sm print:p-0">
      <div className="max-w-[80mm] mx-auto pb-8">
        {/* Header */}
        <div className="text-center mb-6 border-b border-dashed border-black pb-4">
          <h1 className="text-2xl font-bold">BAR POS</h1>
          <p>Jl. Sudirman No. 123</p>
          <p>Telp: 0812-3456-7890</p>
        </div>

        {/* Info */}
        <div className="mb-4">
          <div className="flex justify-between">
            <span>Bill:</span>
            <span>{bill.nomorBill ? `#${bill.nomorBill.toString().padStart(3, '0')}` : bill.id.split('-')[0].toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span>{new Date(bill.waktuBuka).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir:</span>
            <span>{bill.kasir?.nama || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>Sofa:</span>
            <span>{bill.sofa?.nama || bill.tipe}</span>
          </div>
        </div>

        {/* Items */}
        <div className="border-t border-b border-dashed border-black py-4 mb-4">
          {bill.billItems.filter(i => !i.isVoid && !i.diretur && !i.isComp).map(item => (
            <div key={item.id} className="mb-2">
              <div className="flex justify-between">
                <span>{item.namaItem}</span>
                <span>Rp {(item.harga * item.qty).toLocaleString('id-ID')}</span>
              </div>
              <div className="text-gray-500 ml-4">
                {item.qty} x {item.harga.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
          {/* Show Comp items as Rp 0 */}
          {bill.billItems.filter(i => i.isComp).map(item => (
            <div key={item.id} className="mb-2">
              <div className="flex justify-between">
                <span>{item.namaItem} (COMP)</span>
                <span>Rp 0</span>
              </div>
              <div className="text-gray-500 ml-4 line-through">
                {item.qty} x {item.harga.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1 text-right">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rp {bill.subtotal.toLocaleString('id-ID')}</span>
          </div>
          {bill.diskon > 0 && (
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>-Rp {bill.diskon.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Service Charge</span>
            <span>Rp {bill.service.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>Rp {bill.pajak.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-dashed border-black">
            <span>Total</span>
            <span>Rp {bill.total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="text-center mt-8 border-t border-dashed border-black pt-4">
          <p className="font-bold">TERIMA KASIH</p>
          <p>Silakan bawa tagihan ini ke kasir.</p>
        </div>
      </div>

      {/* Auto print script */}
      <script dangerouslySetInnerHTML={{ __html: `window.print()` }} />
    </div>
  )
}

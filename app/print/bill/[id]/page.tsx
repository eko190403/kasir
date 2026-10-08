import { prisma } from "@/lib/prisma"

export const instant = false

const formatMoney = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`

export default async function PrintBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [bill, settings] = await Promise.all([
    prisma.bill.findUnique({
      where: { id },
      include: { billItems: true, sofa: true, kasir: true }
    }),
    prisma.setting.findMany()
  ])

  if (!bill) return <div>Bill not found</div>

  const getSetting = (kunci: string, fallback: string) => settings.find(s => s.kunci === kunci)?.nilai || fallback
  const namaBar = getSetting('NAMA_BAR', 'BAR POS')
  const alamatBar = getSetting('ALAMAT_BAR', 'Jl. Sudirman No. 123')
  const normalItems = bill.billItems.filter((item) => !item.isVoid && !item.diretur && !item.isComp)
  const compItems = bill.billItems.filter((item) => item.isComp)

  return (
    <div className="bg-white text-black min-h-screen p-8 font-mono text-sm print:p-0">
      <div className="max-w-[80mm] mx-auto pb-8">
        <div className="text-center mb-6 border-b border-dashed border-black pb-4">
          <h1 className="text-[22px] font-black tracking-tight">{namaBar}</h1>
          <p className="text-[10px] mt-1">{alamatBar}</p>
          <p className="font-bold mt-2 text-[11px] tracking-[0.2em]">BILL / ORDER</p>
        </div>

        <div className="mb-4 space-y-1 text-[11px]">
          <div className="flex justify-between gap-3">
            <span>Bill</span>
            <span>{bill.nomorBill ? `#${bill.nomorBill.toString().padStart(3, '0')}` : bill.id.slice(0, 6).toUpperCase()}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Waktu</span>
            <span>{new Date(bill.waktuBuka).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Kasir</span>
            <span>{bill.kasir?.nama || '-'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Sofa</span>
            <span>{bill.sofa?.nama || bill.tipe}</span>
          </div>
        </div>

        <div className="border-t border-b border-dashed border-black py-4 mb-4">
          {normalItems.length === 0 && compItems.length === 0 ? (
            <p className="text-center text-gray-500 italic text-[10px]">Belum ada item</p>
          ) : (
            <>
              {normalItems.map(item => (
                <div key={item.id} className="mb-2">
                  <div className="flex justify-between gap-2">
                    <span className="max-w-[60%] break-words">{item.namaItem}</span>
                    <span>{formatMoney(item.harga * item.qty)}</span>
                  </div>
                  <div className="text-gray-500 ml-1 text-[10px]">
                    {item.qty} x {formatMoney(item.harga)}
                    {item.catatan ? ` • ${item.catatan}` : ''}
                  </div>
                </div>
              ))}

              {compItems.map(item => (
                <div key={item.id} className="mb-2">
                  <div className="flex justify-between gap-2 text-gray-700">
                    <span className="max-w-[60%] break-words line-through">{item.namaItem} (COMP)</span>
                    <span>Rp 0</span>
                  </div>
                  <div className="text-gray-500 ml-1 text-[10px] line-through">
                    {item.qty} x {formatMoney(item.harga)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(bill.subtotal)}</span>
          </div>
          {bill.diskon > 0 && (
            <div className="flex justify-between text-red-700">
              <span>Diskon</span>
              <span>- {formatMoney(bill.diskon)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Service</span>
            <span>{formatMoney(bill.service)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>{formatMoney(bill.pajak)}</span>
          </div>
          <div className="flex justify-between font-black text-base mt-2 pt-2 border-t border-dashed border-black">
            <span>Total</span>
            <span>{formatMoney(bill.total)}</span>
          </div>
        </div>

        <div className="text-center mt-8 border-t border-dashed border-black pt-4 text-[10px]">
          <p className="font-bold text-[12px]">TERIMA KASIH</p>
          <p className="mt-1">Silakan bawa tagihan ini ke kasir.</p>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `window.print()` }} />
    </div>
  )
}

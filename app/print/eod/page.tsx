import { prisma } from "@/lib/prisma"
import { connection } from "next/server"
import { getStartOfDayWIB, getEndOfDayWIB } from "@/lib/timezone"

export const instant = false

export default async function PrintEODPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await connection()
  const { date } = await searchParams

  const targetDate = date ? getStartOfDayWIB(date) : getStartOfDayWIB()
  const nextDate = getEndOfDayWIB(targetDate)

  const [bills, settings, shifts] = await Promise.all([
    prisma.bill.findMany({
      where: {
        status: "LUNAS",
        waktuTutup: { gte: targetDate, lt: nextDate }
      },
      include: { sofa: true, kasir: true },
      orderBy: { nomorBill: 'asc' }
    }),
    prisma.setting.findMany(),
    prisma.shift.findMany({
      where: { waktuBuka: { gte: targetDate, lt: nextDate } },
      include: { kasir: true }
    })
  ])

  const getSetting = (kunci: string, fallback: string) => settings.find(s => s.kunci === kunci)?.nilai || fallback
  const namaBar = getSetting('NAMA_BAR', 'LSD SUPERBAR')
  const alamatBar = getSetting('ALAMAT_BAR', 'Jl. Gatot Subroto Barat No.317')
  
  const dateStr = targetDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // --- Calculations ---
  const totalPendapatan = bills.reduce((acc, b) => acc + b.total, 0)
  const totalSubtotal = bills.reduce((acc, b) => acc + b.subtotal, 0)
  const totalDiskon = bills.reduce((acc, b) => acc + b.diskon, 0)
  const totalPajak = bills.reduce((acc, b) => acc + b.pajak, 0)
  const totalService = bills.reduce((acc, b) => acc + b.service, 0)
  const totalPettyCash = shifts.reduce((acc, s) => acc + s.pengeluaran, 0)
  const totalKasBuka = shifts.reduce((acc, s) => acc + s.kasAwal, 0)

  const normalizeMethodKey = (method?: string | null) => {
    const raw = (method ?? 'TUNAI').trim().toUpperCase()
    if (!raw) return 'TUNAI'
    if (raw.startsWith('SPLIT')) return 'SPLIT'
    return raw
  }

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {}
  bills.forEach(b => {
    const method = normalizeMethodKey(b.metodeBayar)
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + b.total
  })

  // Per-sofa breakdown
  const sofaBreakdown: Record<string, { total: number, count: number }> = {}
  bills.forEach(b => {
    const key = b.sofa?.nama || 'Take Away'
    if (!sofaBreakdown[key]) sofaBreakdown[key] = { total: 0, count: 0 }
    sofaBreakdown[key].total += b.total
    sofaBreakdown[key].count += 1
  })
  const sofaSorted = Object.entries(sofaBreakdown).sort((a, b) => b[1].total - a[1].total)

  // Total pax (jumlah tamu)
  const totalPax = bills.length

  const cashReceived = Object.entries(paymentBreakdown)
    .filter(([method]) => ['TUNAI', 'CASH'].includes(method))
    .reduce((sum, [, amount]) => sum + amount, 0)
  const nonCashSales = Object.entries(paymentBreakdown)
    .filter(([method]) => !['TUNAI', 'CASH'].includes(method))
    .reduce((sum, [, amount]) => sum + amount, 0)
  const balance = totalKasBuka + cashReceived - totalPettyCash
  const cashTolerance = 50000
  const cashDifference = (shifts.reduce((sum, shift) => sum + (shift.kasAkhir ?? (shift.kasAwal + (shift.totalPenjualan || 0) - (shift.pengeluaran || 0))), 0)) - (totalKasBuka + cashReceived - totalPettyCash)
  const cashStatus = Math.abs(cashDifference) <= cashTolerance ? 'SESUAI' : Math.abs(cashDifference) <= cashTolerance * 2 ? 'WASPADA' : 'KRITIS'

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
  const dashes = '─'.repeat(42)
  const doubleDashes = '═'.repeat(42)

  return (
    <div className="bg-white text-black min-h-screen p-8 font-mono text-xs print:p-0 print:text-[10px]">
      <div className="max-w-[80mm] mx-auto pb-8">
        
        {/* Header */}
        <div className="text-center mb-4 border-b-2 border-dashed border-black pb-3">
          <h1 className="text-xl font-bold">{namaBar}</h1>
          <p className="text-[10px]">{alamatBar}</p>
          <p className="font-bold mt-2 text-sm tracking-widest">CLOSING REPORT</p>
          <p className="text-[10px] mt-1">{dateStr}</p>
          <p className="text-[10px]">Dicetak: {new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
        </div>

        {/* ─── Bill List per Meja ─── */}
        <div className="mb-2">
          <p className="text-center font-bold mb-1">── DETAIL TRANSAKSI ──</p>
        </div>

        {bills.map(b => (
          <div key={b.id} className="flex justify-between leading-tight">
            <span className="truncate max-w-[55%]">
              {b.nomorBill ? `#${String(b.nomorBill).padStart(3, '0')}` : b.id.slice(0,6).toUpperCase()}
              /{b.sofa?.nama || 'TA'}
            </span>
            <span className="text-right">
              {b.metodeBayar || '-'} - {fmt(b.total)}
            </span>
          </div>
        ))}

        {bills.length === 0 && (
          <p className="text-center text-gray-400 italic py-2">Tidak ada transaksi</p>
        )}

        {/* ─── Per Sofa Breakdown ─── */}
        <div className="mt-3 mb-2 border-t border-dashed border-black pt-2">
          <p className="text-center font-bold mb-1">── PENDAPATAN PER MEJA ──</p>
        </div>

        {sofaSorted.map(([nama, data]) => (
          <div key={nama} className="flex justify-between leading-tight">
            <span>{nama} ({data.count} bill)</span>
            <span className="font-bold">{fmt(data.total)}</span>
          </div>
        ))}

        {/* ─── Payment Details ─── */}
        <div className="mt-3 mb-2 border-t border-dashed border-black pt-2">
          <p className="text-center font-bold mb-1">── PAYMENT DETAILS ──</p>
        </div>

        {Object.entries(paymentBreakdown).map(([method, amount]) => (
          <div key={method} className="flex justify-between leading-tight">
            <span>{method}</span>
            <span className="font-bold">{fmt(amount)}</span>
          </div>
        ))}

        <div className="border-t border-black mt-1 pt-1">
          <div className="flex justify-between font-bold">
            <span>TOTAL PAYMENT :</span>
            <span>{fmt(totalPendapatan)}</span>
          </div>
        </div>

        <div className="mt-3 mb-2 border-t border-dashed border-black pt-2">
          <p className="text-center font-bold mb-1">── REKONSILIASI KAS ──</p>
        </div>
        <div className="flex justify-between">
          <span>STATUS</span>
          <span className="font-bold">{cashStatus}</span>
        </div>
        <div className="flex justify-between">
          <span>SESUAI TOLERANSI</span>
          <span>± {fmt(cashTolerance)}</span>
        </div>
        <div className="flex justify-between">
          <span>SELISIH</span>
          <span className={cashDifference >= 0 ? 'font-bold' : 'font-bold text-red-700'}>{cashDifference >= 0 ? `+ ${fmt(cashDifference)}` : `- ${fmt(Math.abs(cashDifference))}`}</span>
        </div>

        {/* ─── Sales Summary ─── */}
        <div className="mt-3 mb-2 border-t border-dashed border-black pt-2">
          <p className="text-center font-bold mb-1">── SALES SUMMARY ──</p>
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>TOTAL INVOICE</span>
            <span className="font-bold">{totalPax}</span>
          </div>
          <div className="flex justify-between">
            <span>TOTAL MEJA TERPAKAI</span>
            <span className="font-bold">{sofaSorted.length}</span>
          </div>

          <div className="border-t border-dashed border-black mt-1 pt-1" />

          <div className="flex justify-between">
            <span>SUBTOTAL</span>
            <span>{fmt(totalSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>DISKON</span>
            <span>{totalDiskon > 0 ? `- ${fmt(totalDiskon)}` : fmt(0)}</span>
          </div>
          <div className="flex justify-between">
            <span>SERVICE CHARGE</span>
            <span>{fmt(totalService)}</span>
          </div>
          <div className="flex justify-between">
            <span>PAJAK</span>
            <span>{fmt(totalPajak)}</span>
          </div>

          <div className="border-t border-black mt-1 pt-1" />

          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL SALES</span>
            <span>{fmt(totalPendapatan)}</span>
          </div>

          <div className="border-t border-dashed border-black mt-1 pt-1" />

          <div className="flex justify-between">
            <span>OPENING (Kas Buka)</span>
            <span>{fmt(totalKasBuka)}</span>
          </div>
          <div className="flex justify-between">
            <span>PENJUALAN TUNAI</span>
            <span>{fmt(cashReceived)}</span>
          </div>
          <div className="flex justify-between">
            <span>NON TUNAI</span>
            <span>{fmt(nonCashSales)}</span>
          </div>
          <div className="flex justify-between">
            <span>KAS KELUAR</span>
            <span>{totalPettyCash > 0 ? `- ${fmt(totalPettyCash)}` : fmt(0)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>BALANCE (Kas Akhir)</span>
            <span>{fmt(balance)}</span>
          </div>
        </div>

        {/* ─── Shift Info ─── */}
        {shifts.length > 0 && (
          <>
            <div className="mt-3 mb-2 border-t border-dashed border-black pt-2">
              <p className="text-center font-bold mb-1">── SHIFT INFO ──</p>
            </div>
            {shifts.map(s => (
              <div key={s.id} className="mb-1 text-[10px]">
                <div className="flex justify-between">
                  <span>{s.kasir?.nama || 'Staf'}</span>
                  <span>
                    {new Date(s.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    {s.waktuTutup ? ` - ${new Date(s.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ' (masih buka)'}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Footer */}
        <div className="mt-4 text-center border-t border-dashed border-black pt-3">
          <p className="font-bold text-[10px]">── END OF DAY REPORT ──</p>
          <p className="mt-2 text-[9px] text-gray-400">Powered by Bar POS System</p>
        </div>

        {/* Auto Print Script */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.onload = function() {
            window.print();
          }
        `}} />
      </div>
    </div>
  )
}

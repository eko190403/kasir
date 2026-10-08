import { prisma } from "@/lib/prisma"
import { connection } from "next/server"
import { Receipt, Banknote, Landmark, Percent, Download, CreditCard, Flame, Activity, ShieldAlert, History, Calendar, PieChart, Printer } from "lucide-react"

import { getStartOfDayWIB, getEndOfDayWIB } from "@/lib/timezone"

export const instant = false

export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await connection()
  const { date } = await searchParams
  
  // Set target date (default to today)
  const targetDate = date ? getStartOfDayWIB(date) : getStartOfDayWIB()
  const nextDate = getEndOfDayWIB(targetDate)
  
  const bills = await prisma.bill.findMany({
    where: {
      status: "LUNAS",
      waktuTutup: { gte: targetDate, lt: nextDate }
    },
    include: {
      sofa: true,
      billItems: true
    },
    orderBy: { waktuTutup: 'desc' }
  })

  const totalPendapatan = bills.reduce((acc, b) => acc + b.total, 0)
  const totalSubtotal = bills.reduce((acc, b) => acc + b.subtotal, 0)
  const totalDiskon = bills.reduce((acc, b) => acc + b.diskon, 0)
  const totalPajak = bills.reduce((acc, b) => acc + b.pajak, 0)
  const totalService = bills.reduce((acc, b) => acc + b.service, 0)

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {}
  bills.forEach(b => {
    const method = b.metodeBayar || 'Tidak diketahui'
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + b.total
  })

  // Fetch Void & Comp items for the day
  const voidCompItems = await prisma.billItem.findMany({
    where: {
      bill: { waktuTutup: { gte: targetDate, lt: nextDate } },
      OR: [{ isVoid: true }, { isComp: true }]
    },
    include: { bill: { include: { sofa: true } } }
  })

  // Per-sofa performance
  const sofaPerf: Record<string, { nama: string, total: number, transaksi: number }> = {}
  bills.forEach(b => {
    const key = b.sofa?.nama || 'Take Away / Lainnya'
    if (!sofaPerf[key]) sofaPerf[key] = { nama: key, total: 0, transaksi: 0 }
    sofaPerf[key].total += b.total
    sofaPerf[key].transaksi += 1
  })
  const sofaPerfSorted = Object.values(sofaPerf).sort((a, b) => b.total - a.total)

  // Top selling menu items
  const menuSales: Record<string, { nama: string, qty: number, total: number }> = {}
  bills.forEach(b => {
    b.billItems.filter(i => !i.isVoid && !i.diretur).forEach(i => {
      if (!menuSales[i.namaItem]) menuSales[i.namaItem] = { nama: i.namaItem, qty: 0, total: 0 }
      menuSales[i.namaItem].qty += i.qty
      menuSales[i.namaItem].total += i.harga * i.qty
    })
  })
  const topMenu = Object.values(menuSales).sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Fetch Shifts for Petty Cash calculation
  const shifts = await prisma.shift.findMany({
    where: { waktuBuka: { gte: targetDate, lt: nextDate } }
  })
  const totalPettyCash = shifts.reduce((acc, s) => acc + s.pengeluaran, 0)

  // Recent audit logs
  const auditLogs = await prisma.auditLog.findMany({
    where: { waktu: { gte: targetDate, lt: nextDate } },
    orderBy: { waktu: 'desc' },
    take: 20
  })

  // Format YYYY-MM-DD for date input (uses local timezone to prevent off-by-one errors)
  const dateString = targetDate.toLocaleDateString('en-CA')

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex flex-col md:flex-row justify-between md:items-center pb-4 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PieChart className="w-8 h-8 text-emerald-500" />
            Ringkasan Laporan
          </h1>
          <span className="text-sm text-zinc-400">{targetDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        
        <form className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="date" 
              name="date"
              defaultValue={dateString}
              className="bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-white"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition shadow-lg">
            Filter
          </button>
          <a
            href={`/print/eod?date=${dateString}`}
            target="_blank"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-lg"
          >
            <Printer className="w-4 h-4" /> Struk Thermal
          </a>
          <a
            href={`/api/export-csv?date=${dateString}`}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-lg"
            download
          >
            <Download className="w-4 h-4" /> CSV
          </a>
        </form>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900/40 to-zinc-900 border border-blue-800/50 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition">
          <div className="absolute -right-4 -top-4 bg-blue-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-blue-500/20 transition" />
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Receipt className="w-5 h-5" /></div>
            <div className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Total Transaksi</div>
          </div>
          <div className="text-3xl font-black text-white">{bills.length}</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 border border-emerald-800/50 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition">
          <div className="absolute -right-4 -top-4 bg-emerald-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-emerald-500/20 transition" />
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Banknote className="w-5 h-5" /></div>
            <div className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">Total Pendapatan</div>
          </div>
          <div className="text-2xl font-black text-emerald-400">Rp {totalPendapatan.toLocaleString('id-ID')}</div>
        </div>

        <div className="bg-gradient-to-br from-amber-900/40 to-zinc-900 border border-amber-800/50 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/50 transition">
          <div className="absolute -right-4 -top-4 bg-amber-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-amber-500/20 transition" />
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><Landmark className="w-5 h-5" /></div>
            <div className="text-amber-200 text-xs font-semibold uppercase tracking-wider">Total Pajak</div>
          </div>
          <div className="text-2xl font-black text-amber-400">Rp {totalPajak.toLocaleString('id-ID')}</div>
        </div>

        <div className="bg-gradient-to-br from-red-900/40 to-zinc-900 border border-red-800/50 p-5 rounded-2xl relative overflow-hidden group hover:border-red-500/50 transition">
          <div className="absolute -right-4 -top-4 bg-red-500/10 w-24 h-24 rounded-full blur-xl group-hover:bg-red-500/20 transition" />
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><Percent className="w-5 h-5" /></div>
            <div className="text-red-200 text-xs font-semibold uppercase tracking-wider">Total Diskon</div>
          </div>
          <div className="text-2xl font-black text-red-400">Rp {totalDiskon.toLocaleString('id-ID')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
          <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            Rincian Metode Bayar
          </h2>
          <div className="space-y-3">
            {Object.entries(paymentBreakdown).map(([method, amount]) => (
              <div key={method} className="flex justify-between items-center text-sm p-2 hover:bg-zinc-800/50 rounded-lg transition">
                <span className="text-zinc-300">{method}</span>
                <span className="font-bold text-white bg-zinc-800 px-3 py-1 rounded-full">Rp {amount.toLocaleString('id-ID')}</span>
              </div>
            ))}
            {Object.keys(paymentBreakdown).length === 0 && (
              <div className="text-zinc-500 italic text-sm text-center py-4">Belum ada transaksi hari ini.</div>
            )}
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
          <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-400" />
            Rincian Keuangan
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-2">
              <span className="text-zinc-400">Subtotal</span>
              <span className="font-medium">Rp {totalSubtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-red-950/20 text-red-400 rounded-lg">
              <span>Diskon</span>
              <span className="font-medium">- Rp {totalDiskon.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center p-2">
              <span className="text-zinc-400">Service Charge</span>
              <span className="font-medium">Rp {totalService.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center p-2">
              <span className="text-zinc-400">Pajak</span>
              <span className="font-medium">Rp {totalPajak.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center font-bold text-lg text-emerald-400 pt-3 border-t border-zinc-800">
              <span>Total Pendapatan (Gross)</span>
              <span>Rp {totalPendapatan.toLocaleString('id-ID')}</span>
            </div>
            
            <div className="flex justify-between items-center p-2 bg-amber-950/20 text-amber-400 rounded-lg mt-2">
              <span>Kas Keluar (Petty Cash)</span>
              <span className="font-medium">- Rp {totalPettyCash.toLocaleString('id-ID')}</span>
            </div>

            <div className="flex justify-between items-center font-bold text-xl text-white pt-3 border-t border-zinc-800 mt-2">
              <span>Pendapatan Bersih (Netto)</span>
              <span>Rp {(totalPendapatan - totalPettyCash - totalPajak - totalService).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Menu Terlaris */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
        <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          Top 10 Menu Terlaris
        </h2>
        {topMenu.length === 0 ? (
          <div className="text-zinc-500 italic text-sm text-center py-4">Belum ada data hari ini.</div>
        ) : (
          <div className="space-y-4">
            {topMenu.map((m, idx) => {
              const maxQty = topMenu[0].qty;
              const pct = maxQty > 0 ? Math.round((m.qty / maxQty) * 100) : 0;
              return (
                <div key={m.nama} className="group">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold">{idx + 1}</span>
                      <span className="font-medium text-zinc-200 group-hover:text-white transition">{m.nama}</span>
                      <span className="bg-amber-500/20 text-amber-400 font-bold text-xs px-2 py-0.5 rounded-full">{m.qty} porsi</span>
                    </span>
                    <span className="text-zinc-400 font-medium">Rp {m.total.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-600 to-amber-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sofa Performance */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
        <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Kinerja per Sofa/Area
        </h2>
        {sofaPerfSorted.length === 0 ? (
          <div className="text-zinc-500 italic text-sm text-center py-4">Belum ada data hari ini.</div>
        ) : (
          <div className="space-y-4">
            {sofaPerfSorted.map((s, idx) => {
              const pct = totalPendapatan > 0 ? Math.round((s.total / totalPendapatan) * 100) : 0
              return (
                <div key={s.nama} className="group">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold">{idx + 1}</span>
                      <span className="font-medium text-zinc-200 group-hover:text-white transition">{s.nama}</span>
                      <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-0.5 rounded-full">{s.transaksi} transaksi</span>
                      <span className="text-zinc-500 text-xs">Rata-rata: Rp {Math.round(s.total / s.transaksi).toLocaleString('id-ID')}</span>
                    </span>
                    <span className="font-bold text-emerald-400">Rp {s.total.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-violet-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
        <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" />
          Transaksi Terbaru
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-zinc-400 text-xs uppercase bg-zinc-800/50 rounded-lg">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Waktu</th>
                <th className="px-4 py-3">Sofa/Tipe</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Diskon</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 rounded-r-lg">Bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {bills.map(bill => (
                <tr key={bill.id} className="hover:bg-zinc-800/30 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-300">{bill.waktuTutup ? new Date(bill.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="px-4 py-3 font-medium text-white">{bill.sofa?.nama || bill.tipe.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">Rp {bill.subtotal.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right text-red-400">{bill.diskon > 0 ? `- Rp ${bill.diskon.toLocaleString('id-ID')}` : '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-400">Rp {bill.total.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="bg-zinc-800 px-2 py-1 rounded-md text-xs font-semibold">{bill.metodeBayar || '-'}</span></td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-zinc-500 italic text-center">Belum ada transaksi hari ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void & Comp Log */}
      <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <span className="text-red-100">Log Void & Comp</span>
          {voidCompItems.length > 0 && (
            <span className="ml-auto text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded-full font-bold">{voidCompItems.length} item</span>
          )}
        </h2>
        {voidCompItems.length === 0 ? (
          <div className="text-zinc-500 italic text-sm text-center py-4">Tidak ada item yang di-Void atau Comp hari ini. 👍</div>
        ) : (
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-sm text-left">
              <thead className="text-zinc-400 text-xs uppercase bg-zinc-800/50 rounded-lg">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Item</th>
                  <th className="px-4 py-3">Sofa</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3 text-right">Harga</th>
                  <th className="px-4 py-3 rounded-r-lg">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {voidCompItems.map(item => (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 font-medium text-zinc-200">{item.qty}x {item.namaItem}</td>
                    <td className="px-4 py-3 text-zinc-400">{item.bill.sofa?.nama || 'Take Away'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-md font-bold uppercase tracking-wider ${item.isVoid ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'}`}>
                        {item.isVoid ? 'VOID' : 'COMP'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right line-through text-zinc-500">Rp {(item.harga * item.qty).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs italic">{item.alasanVoidComp || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
        <h2 className="font-bold text-lg mb-4 border-b border-zinc-800 pb-3 flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-400" />
          Audit Log Hari Ini
        </h2>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {auditLogs.map(log => (
            <div key={log.id} className="text-xs flex gap-4 py-2.5 px-3 hover:bg-zinc-800/50 rounded-lg transition">
              <span className="text-zinc-500 shrink-0 font-mono">{new Date(log.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className={`font-bold shrink-0 w-24 ${log.aksi === 'RETURN_ITEM' ? 'text-red-400' : log.aksi === 'CLOSE_BILL' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {log.aksi}
              </span>
              <span className="text-zinc-300 truncate">{log.detail}</span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="text-zinc-500 italic text-sm text-center py-4">Belum ada log hari ini.</div>
          )}
        </div>
      </div>
    </main>
  )
}

import { prisma } from "@/lib/prisma"
import { connection } from "next/server"
import { Landmark, Download, CreditCard, Flame, Activity, ShieldAlert, History, Printer } from "lucide-react"

import { getStartOfDayWIB, getEndOfDayWIB } from "@/lib/timezone"
import { summarizeShiftCash } from "@/lib/shift-math"
import { requirePageRole } from "@/lib/page-auth"

export const instant = false

export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePageRole(["MANAJER"])
  await connection()
  const { date } = await searchParams
  
  // Set target date (default to today)
  const targetDate = date ? getStartOfDayWIB(date) : getStartOfDayWIB()
  const nextDate = getEndOfDayWIB(targetDate)
  
  const bills = await prisma.bill.findMany({
    where: {
      status: "LUNAS",
      waktuTutup: { gte: targetDate, lte: nextDate }
    },
    include: {
      payments: true,
      sofa: true,
      kasir: true,
      billItems: {
        include: { menuItem: true }
      }
    },
    orderBy: { waktuTutup: 'desc' }
  })

  const totalPendapatan = bills.reduce((acc, b) => acc + b.total, 0)
  const totalSubtotal = bills.reduce((acc, b) => acc + b.subtotal, 0)
  const totalDiskon = bills.reduce((acc, b) => acc + b.diskon, 0)
  const totalPajak = bills.reduce((acc, b) => acc + b.pajak, 0)
  const totalService = bills.reduce((acc, b) => acc + b.service, 0)
  const avgTicket = bills.length > 0 ? totalPendapatan / bills.length : 0

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {}
  bills.forEach(b => {
    const entries = b.payments.length > 0
      ? b.payments.map(payment => ({ method: payment.metode, amount: payment.jumlah }))
      : [{ method: b.metodeBayar || 'Tidak diketahui', amount: b.total }]
    entries.forEach(({ method, amount }) => {
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amount
    })
  })

  // Fetch Void & Comp items for the day
  const voidCompItems = await prisma.billItem.findMany({
    where: {
      bill: { waktuTutup: { gte: targetDate, lte: nextDate } },
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
    where: { waktuBuka: { gte: targetDate, lt: nextDate } },
    include: {
      kasir: true,
      bills: {
        where: { status: "LUNAS" },
        include: { payments: true }
      }
    }
  })
  const totalPettyCash = shifts.reduce((acc, s) => acc + s.pengeluaran, 0)
  const cashSummary = summarizeShiftCash(shifts)
  const totalOpeningCash = shifts.reduce((acc, s) => acc + s.kasAwal, 0)
  const totalCashSales = cashSummary.cashSales
  const cashDifference = cashSummary.cashDifference
  const totalNetto = Math.max(0, totalPendapatan - totalPettyCash)

  const categoryBreakdown: Record<string, { nama: string, total: number, qty: number }> = {}
  bills.forEach(b => {
    b.billItems.filter(i => !i.isVoid && !i.diretur && !i.isComp).forEach(item => {
      const key = item.menuItem?.kategori || 'LAINNYA'
      if (!categoryBreakdown[key]) categoryBreakdown[key] = { nama: key, total: 0, qty: 0 }
      categoryBreakdown[key].total += item.harga * item.qty
      categoryBreakdown[key].qty += item.qty
    })
  })
  const categoryList = Object.values(categoryBreakdown).sort((a, b) => b.total - a.total)

  const cashierBreakdown: Record<string, { nama: string, total: number, transaksi: number }> = {}
  bills.forEach(b => {
    const key = b.kasirId || 'UNKNOWN'
    const nama = b.kasir?.nama || 'Kasir tidak tercatat'
    if (!cashierBreakdown[key]) cashierBreakdown[key] = { nama, total: 0, transaksi: 0 }
    cashierBreakdown[key].total += b.total
    cashierBreakdown[key].transaksi += 1
  })
  const cashierList = Object.values(cashierBreakdown).sort((a, b) => b.total - a.total)

  // Recent audit logs
  const auditLogs = await prisma.auditLog.findMany({
    where: { waktu: { gte: targetDate, lt: nextDate } },
    orderBy: { waktu: 'desc' },
    take: 20
  })

  // Format YYYY-MM-DD for date input (uses local timezone to prevent off-by-one errors)
  const dateString = targetDate.toLocaleDateString('en-CA')
  const panelClass = "rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5"
  const panelHeadingClass = "mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3 text-base font-semibold text-zinc-100"

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">LAPORAN HARIAN</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Ringkasan</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {targetDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Tanggal laporan
            <input
              type="date"
              name="date"
              defaultValue={dateString}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </label>
          <button type="submit" className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500">
            Tampilkan
          </button>
          <a
            href={`/print/eod?date=${dateString}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Printer className="h-4 w-4" /> Cetak
          </a>
          <a
            href={`/api/export-csv?date=${dateString}`}
            className="flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            download
          >
            <Download className="h-4 w-4" /> Ekspor CSV
          </a>
        </form>
      </header>

      <section aria-label="Ringkasan penjualan" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Pendapatan kotor", value: `Rp ${totalPendapatan.toLocaleString('id-ID')}`, primary: true },
          { label: "Transaksi lunas", value: bills.length.toLocaleString('id-ID') },
          { label: "Rata-rata transaksi", value: `Rp ${Math.round(avgTicket).toLocaleString('id-ID')}` },
          { label: "Pajak", value: `Rp ${totalPajak.toLocaleString('id-ID')}` },
          { label: "Diskon", value: `Rp ${totalDiskon.toLocaleString('id-ID')}` },
        ].map(({ label, value, primary }) => (
          <div key={label} className="min-w-0 bg-zinc-900 px-4 py-4 sm:px-5">
            <p className="mb-2 text-xs text-zinc-400">{label}</p>
            <p className={`truncate tabular-nums ${primary ? "text-xl font-semibold text-amber-300" : "text-lg font-medium text-zinc-100"}`}>
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Payment Breakdown */}
        <section className={panelClass}>
          <h2 className={panelHeadingClass}>
            <CreditCard className="h-4 w-4 text-amber-400" />
            Rincian Metode Bayar
          </h2>
          <div className="divide-y divide-zinc-800">
            {Object.entries(paymentBreakdown).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-zinc-400">{method}</span>
                <span className="font-medium tabular-nums text-zinc-100">Rp {amount.toLocaleString('id-ID')}</span>
              </div>
            ))}
            {Object.keys(paymentBreakdown).length === 0 && (
              <div className="py-6 text-center text-sm text-zinc-500">Belum ada transaksi pada tanggal ini.</div>
            )}
          </div>
        </section>

        {/* Financial Breakdown */}
        <section className={panelClass}>
          <h2 className={panelHeadingClass}>
            <Landmark className="h-4 w-4 text-amber-400" />
            Rincian Keuangan
          </h2>
          <div className="space-y-0.5 text-sm">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-zinc-400">Subtotal</span>
              <span className="tabular-nums text-zinc-200">Rp {totalSubtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-zinc-400">Diskon</span>
              <span className="tabular-nums text-zinc-200">- Rp {totalDiskon.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-zinc-400">Service Charge</span>
              <span className="tabular-nums text-zinc-200">Rp {totalService.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-zinc-400">Pajak</span>
              <span className="tabular-nums text-zinc-200">Rp {totalPajak.toLocaleString('id-ID')}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-zinc-800 pt-3 font-medium text-zinc-200">
              <span>Total Pendapatan (Gross)</span>
              <span className="tabular-nums">Rp {totalPendapatan.toLocaleString('id-ID')}</span>
            </div>
            
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-zinc-400">Kas keluar</span>
              <span className="tabular-nums text-zinc-200">- Rp {totalPettyCash.toLocaleString('id-ID')}</span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-4 border-t border-zinc-800 pt-3 text-base font-semibold text-amber-300">
              <span>Pendapatan Bersih (Netto)</span>
              <span className="tabular-nums">Rp {(totalPendapatan - totalPettyCash - totalPajak - totalService).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </section>
      </div>

      <section className={panelClass}>
        <h2 className={panelHeadingClass}>
          <Landmark className="h-4 w-4 text-amber-400" />
          Rekonsiliasi Kas
        </h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-zinc-950/50 p-4">
            <div className="text-xs text-zinc-400">Kas awal</div>
            <div className="mt-2 text-lg font-medium tabular-nums text-zinc-100">Rp {totalOpeningCash.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-zinc-950/50 p-4">
            <div className="text-xs text-zinc-400">Penjualan tunai</div>
            <div className="mt-2 text-lg font-medium tabular-nums text-zinc-100">Rp {totalCashSales.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-zinc-950/50 p-4">
            <div className="text-xs text-zinc-400">Kas keluar</div>
            <div className="mt-2 text-lg font-medium tabular-nums text-zinc-100">- Rp {totalPettyCash.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-zinc-950/50 p-4">
            <div className="text-xs text-zinc-400">Selisih kas</div>
            <div className={`mt-2 text-lg font-medium tabular-nums ${cashDifference === null ? 'text-zinc-400' : cashDifference >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {cashDifference === null ? 'Belum dihitung' : cashDifference >= 0 ? `+ Rp ${cashDifference.toLocaleString('id-ID')}` : `- Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}`}
            </div>
            {cashDifference === null && <p className="mt-1 text-xs text-zinc-400">Tutup shift dan masukkan kas fisik untuk menghitung selisih.</p>}
          </div>
        </div>
      </section>

      {/* Top Menu Terlaris */}
      <section className={panelClass}>
        <h2 className={panelHeadingClass}>
          <Flame className="h-4 w-4 text-amber-400" />
          Menu terlaris
        </h2>
        {topMenu.length === 0 ? (
          <div className="text-zinc-500 italic text-sm text-center py-4">Belum ada data hari ini.</div>
        ) : (
          <div className="space-y-4">
            {topMenu.map((m, idx) => {
              const maxQty = topMenu[0].qty;
              const pct = maxQty > 0 ? Math.round((m.qty / maxQty) * 100) : 0;
              return (
                <div key={m.nama} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
                  <span className="text-xs tabular-nums text-zinc-500">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 truncate font-medium text-zinc-200">{m.nama}</span>
                  <span className="text-right text-zinc-400">{m.qty} porsi <span className="ml-2 font-medium tabular-nums text-zinc-200">Rp {m.total.toLocaleString('id-ID')}</span></span>
                  <span className="col-start-2 col-span-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                    <span className="block h-full rounded-full bg-amber-500/80" style={{ width: `${pct}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sofa Performance */}
      <section className={panelClass}>
        <h2 className={panelHeadingClass}>
          <Activity className="h-4 w-4 text-amber-400" />
          Penjualan per meja/area
        </h2>
        {sofaPerfSorted.length === 0 ? (
          <div className="text-zinc-500 italic text-sm text-center py-4">Belum ada data hari ini.</div>
        ) : (
          <div className="space-y-4">
            {sofaPerfSorted.map((s, idx) => {
              const pct = totalPendapatan > 0 ? Math.round((s.total / totalPendapatan) * 100) : 0
              return (
                <div key={s.nama} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
                  <span className="text-xs tabular-nums text-zinc-500">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 truncate font-medium text-zinc-200">{s.nama}</span>
                  <span className="text-right font-medium tabular-nums text-zinc-200">Rp {s.total.toLocaleString('id-ID')}</span>
                  <span className="col-start-2 text-xs text-zinc-500">{s.transaksi} transaksi · Rata-rata Rp {Math.round(s.total / s.transaksi).toLocaleString('id-ID')}</span>
                  <span className="col-start-2 col-span-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                    <span className="block h-full rounded-full bg-amber-500/80" style={{ width: `${pct}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent Transactions */}
      <section className={panelClass}>
        <h2 className={panelHeadingClass}>
          <History className="h-4 w-4 text-amber-400" />
          Transaksi
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-zinc-800 text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">Waktu</th>
                <th className="px-3 py-3 font-medium">Meja / jenis</th>
                <th className="px-3 py-3 text-right font-medium">Subtotal</th>
                <th className="px-3 py-3 text-right font-medium">Diskon</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 font-medium">Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {bills.map(bill => (
                <tr key={bill.id} className="transition-colors hover:bg-zinc-800/40">
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-zinc-400">{bill.waktuTutup ? new Date(bill.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="px-3 py-3 font-medium text-zinc-200">{bill.sofa?.nama || bill.tipe.replace('_', ' ')}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-400">Rp {bill.subtotal.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-400">{bill.diskon > 0 ? `- Rp ${bill.diskon.toLocaleString('id-ID')}` : '-'}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-zinc-100">Rp {bill.total.toLocaleString('id-ID')}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{bill.metodeBayar || '-'}</td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-zinc-500 italic text-center">Belum ada transaksi hari ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Void & Comp Log */}
      <section className={panelClass}>
        <h2 className={panelHeadingClass}>
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <span>Log void dan comp</span>
          {voidCompItems.length > 0 && (
            <span className="ml-auto text-xs font-medium text-zinc-400">{voidCompItems.length} item</span>
          )}
        </h2>
        {voidCompItems.length === 0 ? (
          <div className="py-5 text-center text-sm text-zinc-500">Tidak ada item void atau comp pada tanggal ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-zinc-800 text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Meja</th>
                  <th className="px-3 py-3 font-medium">Jenis</th>
                  <th className="px-3 py-3 text-right font-medium">Harga</th>
                  <th className="px-3 py-3 font-medium">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {voidCompItems.map(item => (
                  <tr key={item.id} className="transition-colors hover:bg-zinc-800/40">
                    <td className="px-3 py-3 font-medium text-zinc-200">{item.qty}x {item.namaItem}</td>
                    <td className="px-3 py-3 text-zinc-400">{item.bill.sofa?.nama || 'Bawa pulang'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${item.isVoid ? 'text-red-300' : 'text-amber-300'}`}>
                        {item.isVoid ? 'VOID' : 'COMP'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-500">Rp {(item.harga * item.qty).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-3 text-zinc-400">{item.alasanVoidComp || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audit Logs */}
      <section className={panelClass}>
        <h2 className={panelHeadingClass}>
          <History className="h-4 w-4 text-zinc-400" />
          Riwayat aktivitas
        </h2>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {auditLogs.map(log => (
            <div key={log.id} className="flex gap-3 border-b border-zinc-800/70 py-2.5 text-xs last:border-0">
              <span className="shrink-0 font-mono tabular-nums text-zinc-500">{new Date(log.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className={`w-32 shrink-0 font-medium ${log.aksi === 'RETURN_ITEM' ? 'text-red-300' : log.aksi === 'CLOSE_BILL' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {log.aksi}
              </span>
              <span className="min-w-0 truncate text-zinc-400">{JSON.stringify(log.detail)}</span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="py-5 text-center text-sm text-zinc-500">Belum ada aktivitas pada tanggal ini.</div>
          )}
        </div>
        </section>
    </main>
  )
}

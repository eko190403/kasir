"use client"

import { useState } from "react"
import { getEndOfDayReport } from "@/app/actions"
import { FileDown, Printer, TrendingUp, Receipt, AlertTriangle, Gift, Users, Clock } from "lucide-react"

export default function EODReportClient() {
  const today = new Date().toLocaleDateString('en-CA')
  const [tanggal, setTanggal] = useState(today)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const r = await getEndOfDayReport(tanggal)
      setReport(r)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <Clock className="w-4 h-4 text-zinc-400" />
          <input
            type="date"
            value={tanggal}
            onChange={e => setTanggal(e.target.value)}
            className="bg-transparent text-sm focus:outline-none text-white"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          {loading ? "Memuat..." : "Generate Laporan"}
        </button>
        {report && (
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 font-bold rounded-xl transition flex items-center gap-2 print:hidden"
          >
            <Printer className="w-4 h-4" /> Cetak
          </button>
        )}
      </div>

      {report && (
        <div className="space-y-6" id="eod-report">
          {/* Summary Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1">Laporan Harian</h2>
            <p className="text-zinc-400 text-sm mb-5">
              {new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Transaksi', value: `${report.totalTransaksi} Bill`, icon: Receipt, color: 'from-blue-600 to-blue-800', text: 'text-blue-300' },
                { label: 'Pendapatan Bersih', value: fmt(report.totalPendapatan), icon: TrendingUp, color: 'from-emerald-600 to-emerald-800', text: 'text-emerald-300' },
                { label: 'Void (Nominal)', value: fmt(report.totalVoidNominal), icon: AlertTriangle, color: 'from-red-700 to-red-900', text: 'text-red-300' },
                { label: 'Comp (Nominal)', value: fmt(report.totalCompNominal), icon: Gift, color: 'from-purple-600 to-purple-900', text: 'text-purple-300' },
              ].map(({ label, value, icon: Icon, color, text }) => (
                <div key={label} className={`bg-gradient-to-br ${color} p-4 rounded-xl`}>
                  <Icon className={`w-5 h-5 ${text} mb-2`} />
                  <div className={`text-lg font-black ${text}`}>{value}</div>
                  <div className="text-xs text-white/60 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-6 ${report.cashStatus === 'SESUAI' ? 'border-emerald-800/60 bg-emerald-950/20' : report.cashStatus === 'WASPADA' ? 'border-amber-800/60 bg-amber-950/20' : 'border-red-800/60 bg-red-950/20'}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-300">Status Rekonsiliasi Kas</p>
                <h3 className="mt-2 text-2xl font-black text-white">{report.cashStatus}</h3>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-zinc-100">
                Toleransi ± {fmt(report.cashTolerance)}
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-200">{report.cashStatusMessage}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">Kas Akhir Aktual</div>
                <div className="mt-2 text-xl font-black text-white">{fmt(report.actualClosingCash)}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">Kas Diharapkan</div>
                <div className="mt-2 text-xl font-black text-white">{fmt(report.expectedCash)}</div>
              </div>
              <div className={`rounded-xl border p-3 ${report.cashDifference >= 0 ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-red-700/50 bg-red-950/20'}`}>
                <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-300">Selisih</div>
                <div className={`mt-2 text-xl font-black ${report.cashDifference >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {report.cashDifference >= 0 ? `+ ${fmt(report.cashDifference)}` : `- ${fmt(Math.abs(report.cashDifference))}`}
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Keuangan */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> Rincian Keuangan</h3>
            <div className="space-y-2 text-sm max-w-sm">
              {[
                { label: 'Subtotal Penjualan', val: report.totalSubtotal, cls: '' },
                { label: 'Service Charge', val: report.totalService, cls: 'text-zinc-400' },
                { label: 'Pajak (Tax)', val: report.totalPajak, cls: 'text-zinc-400' },
                { label: 'Diskon Diberikan', val: -report.totalDiskon, cls: 'text-red-400' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="flex justify-between">
                  <span className={`text-zinc-400 ${cls}`}>{label}</span>
                  <span className={cls || 'font-medium'}>{val < 0 ? `- ${fmt(-val)}` : fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base border-t border-zinc-700 pt-2 mt-2 text-emerald-400">
                <span>TOTAL PENDAPATAN</span>
                <span>{fmt(report.totalPendapatan)}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Kas Awal', value: report.openingCash },
                { label: 'Penjualan Tunai', value: report.cashSales },
                { label: 'Penjualan Non Tunai', value: report.nonCashSales },
                { label: 'Kas Keluar', value: -report.expenseCash },
                { label: 'Kas Diharapkan', value: report.expectedCash },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-800 rounded-xl p-3 border border-zinc-700">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-2">{label}</div>
                  <div className="text-base font-black text-white">{fmt(value)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold mb-4">Rekonsiliasi Kas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-zinc-400 text-xs uppercase">Kas Akhir Aktual</div>
                <div className="mt-2 text-xl font-black text-emerald-400">{fmt(report.actualClosingCash)}</div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="text-zinc-400 text-xs uppercase">Kas Diharapkan</div>
                <div className="mt-2 text-xl font-black text-blue-400">{fmt(report.expectedCash)}</div>
              </div>
              <div className={`rounded-xl p-4 ${report.cashDifference >= 0 ? 'bg-emerald-950/40 border border-emerald-500/30' : 'bg-red-950/40 border border-red-500/30'}`}>
                <div className="text-zinc-300 text-xs uppercase">Selisih</div>
                <div className={`mt-2 text-xl font-black ${report.cashDifference >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {report.cashDifference >= 0 ? `+ ${fmt(report.cashDifference)}` : `- ${fmt(Math.abs(report.cashDifference))}`}
                </div>
              </div>
            </div>
          </div>

          {/* Metode Bayar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold mb-4">Metode Pembayaran</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(report.byMetode as Record<string, { count: number; total: number }>).map(([metode, data]) => (
                <div key={metode} className="bg-zinc-800 rounded-xl p-4">
                  <div className="font-bold text-sm">{metode}</div>
                  <div className="text-emerald-400 font-black text-lg">{fmt(data.total)}</div>
                  <div className="text-zinc-500 text-xs">{data.count} transaksi</div>
                </div>
              ))}
              {Object.keys(report.byMetode).length === 0 && (
                <div className="text-zinc-500 text-sm italic col-span-3">Tidak ada transaksi.</div>
              )}
            </div>
          </div>

          {/* Shift Summary */}
          {report.shifts.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Ringkasan Shift</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="text-left pb-2">Kasir</th>
                      <th className="text-left pb-2">Buka</th>
                      <th className="text-left pb-2">Tutup</th>
                      <th className="text-right pb-2">Kas Awal</th>
                      <th className="text-right pb-2">Penjualan</th>
                      <th className="text-right pb-2">Kas Keluar</th>
                      <th className="text-right pb-2">Kas Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {report.shifts.map((s: any) => (
                      <tr key={s.id}>
                        <td className="py-2 font-medium">{s.kasir?.nama}</td>
                        <td className="py-2 text-xs text-zinc-400">{new Date(s.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-2 text-xs text-zinc-400">{s.waktuTutup ? new Date(s.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : <span className="text-amber-400">Aktif</span>}</td>
                        <td className="py-2 text-right">{fmt(s.kasAwal)}</td>
                        <td className="py-2 text-right text-emerald-400">{fmt(s.totalPenjualan || 0)}</td>
                        <td className="py-2 text-right text-red-400">{fmt(s.pengeluaran)}</td>
                        <td className="py-2 text-right font-bold">{fmt(s.kasAkhir || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* bySofa Aggregate */}
          {report.bySofa && Object.keys(report.bySofa).length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> Performa per Meja / Sofa</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="text-left pb-2">Nama Meja / Tipe</th>
                      <th className="text-right pb-2">Jumlah Bill</th>
                      <th className="text-right pb-2">Rata-rata/Bill</th>
                      <th className="text-right pb-2">Total Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {Object.entries(report.bySofa)
                      .sort((a: any, b: any) => b[1].total - a[1].total)
                      .map(([key, data]: [string, any]) => (
                        <tr key={key}>
                          <td className="py-2">{data.nama}</td>
                          <td className="py-2 text-right">{data.count}</td>
                          <td className="py-2 text-right text-zinc-400">{fmt(data.average)}</td>
                          <td className="py-2 text-right font-bold text-emerald-400">{fmt(data.total)}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Void & Comp Detail */}
          {(report.voidItems.length > 0 || report.compItems.length > 0) && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Detail Void & Comp</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="text-left pb-2">Tipe</th>
                      <th className="text-left pb-2">Item</th>
                      <th className="text-right pb-2">Qty</th>
                      <th className="text-right pb-2">Nominal</th>
                      <th className="text-left pb-2">Alasan</th>
                      <th className="text-left pb-2">Otorisasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {report.voidItems.map((i: any) => (
                      <tr key={i.id}>
                        <td className="py-1.5"><span className="text-xs px-2 py-0.5 bg-red-900/50 text-red-400 rounded font-bold">VOID</span></td>
                        <td className="py-1.5">{i.namaItem}</td>
                        <td className="py-1.5 text-right">{i.qty}</td>
                        <td className="py-1.5 text-right text-red-400">{fmt(i.harga * i.qty)}</td>
                        <td className="py-1.5 text-zinc-400 text-xs">{i.alasanVoidComp || '-'}</td>
                        <td className="py-1.5 text-zinc-400 text-xs">{i.otorisasiOleh || '-'}</td>
                      </tr>
                    ))}
                    {report.compItems.map((i: any) => (
                      <tr key={i.id}>
                        <td className="py-1.5"><span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-400 rounded font-bold">COMP</span></td>
                        <td className="py-1.5">{i.namaItem}</td>
                        <td className="py-1.5 text-right">{i.qty}</td>
                        <td className="py-1.5 text-right text-purple-400">{fmt(i.harga * i.qty)}</td>
                        <td className="py-1.5 text-zinc-400 text-xs">{i.alasanVoidComp || '-'}</td>
                        <td className="py-1.5 text-zinc-400 text-xs">{i.otorisasiOleh || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daftar Transaksi */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-zinc-400" /> Daftar Transaksi ({report.bills.length})</h3>
            {report.bills.length === 0 ? (
              <p className="text-zinc-500 italic text-sm">Tidak ada transaksi pada tanggal ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="text-left pb-2">No.</th>
                      <th className="text-left pb-2">Meja/Tipe</th>
                      <th className="text-left pb-2">Kasir</th>
                      <th className="text-left pb-2">Waktu Tutup</th>
                      <th className="text-left pb-2">Metode</th>
                      <th className="text-right pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {report.bills.map((b: any) => (
                      <tr key={b.id} className="hover:bg-zinc-800/50">
                        <td className="py-1.5 font-mono text-zinc-500">{b.nomorBill ? `#${String(b.nomorBill).padStart(3,'0')}` : '-'}</td>
                        <td className="py-1.5">{b.sofa?.nama || b.tipe.replace('_', ' ')}</td>
                        <td className="py-1.5 text-zinc-400">{b.kasir?.nama || '-'}</td>
                        <td className="py-1.5 text-xs text-zinc-400">{b.waktuTutup ? new Date(b.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-1.5"><span className="text-xs px-1.5 py-0.5 bg-zinc-800 rounded">{b.metodeBayar}</span></td>
                        <td className="py-1.5 text-right font-bold text-emerald-400">{fmt(b.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-16 text-zinc-600">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Pilih tanggal dan klik "Generate Laporan" untuk melihat laporan harian.</p>
        </div>
      )}
    </div>
  )
}

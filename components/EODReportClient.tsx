"use client"

import { useState } from "react"
import { getEndOfDayReport } from "@/app/actions"
import { Printer, TrendingUp } from "lucide-react"

export default function EODReportClient() {
  const today = new Date().toLocaleDateString('en-CA')
  const [tanggal, setTanggal] = useState(today)
  const [report, setReport] = useState<Awaited<ReturnType<typeof getEndOfDayReport>> | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!tanggal) return
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
  const cashStatusLabel: Record<string, string> = {
    SESUAI: "Sesuai",
    WASPADA: "Perlu diperiksa",
    KRITIS: "Perlu tindakan",
    BELUM_DITUTUP: "Shift belum ditutup",
  }
  const panelClass = "rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5"
  const panelHeadingClass = "mb-4 border-b border-zinc-800 pb-3 text-base font-semibold text-zinc-100"

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Tanggal laporan
          <input
            type="date"
            value={tanggal}
            onChange={e => {
              setTanggal(e.target.value)
              setReport(null)
            }}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </label>
        <button
          onClick={handleGenerate}
          disabled={loading || !tanggal}
          className="flex h-10 items-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Memuat laporan..." : "Tampilkan laporan"}
        </button>
        {report && (
          <button
            onClick={handlePrint}
            className="print:hidden flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Printer className="h-4 w-4" /> Cetak
          </button>
        )}
      </div>

      {report && (
        <div className="space-y-5" id="eod-report">
          <section className={panelClass}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-zinc-100">Ringkasan penjualan</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
              {[
                { label: 'Transaksi lunas', value: `${report.totalTransaksi} bill` },
                { label: 'Pendapatan', value: fmt(report.totalPendapatan), primary: true },
                { label: 'Void', value: fmt(report.totalVoidNominal) },
                { label: 'Comp', value: fmt(report.totalCompNominal) },
              ].map(({ label, value, primary }) => (
                <div key={label} className="min-w-0 bg-zinc-950/60 px-4 py-4">
                  <div className="mb-2 text-xs text-zinc-400">{label}</div>
                  <div className={`truncate text-lg font-semibold tabular-nums ${primary ? "text-amber-300" : "text-zinc-100"}`}>{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={panelClass}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Rekonsiliasi kas</h3>
                <p className="mt-1 text-sm text-zinc-400">{report.cashStatusMessage}</p>
              </div>
              <div className={`w-fit rounded-md border px-3 py-1.5 text-sm font-medium ${
                report.cashStatus === "SESUAI" ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                  : report.cashStatus === "KRITIS" ? "border-red-800 bg-red-950/30 text-red-300"
                    : report.cashStatus === "WASPADA" || report.cashStatus === "BELUM_DITUTUP" ? "border-amber-800 bg-amber-950/30 text-amber-300"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300"
              }`}>
                {cashStatusLabel[report.cashStatus] || "Status tidak diketahui"}
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Batas toleransi: ± {fmt(report.cashTolerance)}</p>
            <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
              <div className="bg-zinc-950/60 p-4">
                <div className="text-xs text-zinc-400">Kas akhir aktual</div>
                <div className="mt-2 text-lg font-medium tabular-nums text-zinc-100">{report.cashDifference === null ? '-' : fmt(report.actualClosingCash)}</div>
              </div>
              <div className="bg-zinc-950/60 p-4">
                <div className="text-xs text-zinc-400">Kas yang diharapkan</div>
                <div className="mt-2 text-lg font-medium tabular-nums text-zinc-100">{fmt(report.expectedCash)}</div>
              </div>
              <div className="bg-zinc-950/60 p-4">
                <div className="text-xs text-zinc-400">Selisih kas</div>
                <div className={`mt-2 text-lg font-medium tabular-nums ${report.cashDifference === null ? 'text-zinc-400' : report.cashDifference >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {report.cashDifference === null ? 'Belum dihitung' : report.cashDifference >= 0 ? `+ ${fmt(report.cashDifference)}` : `- ${fmt(Math.abs(report.cashDifference))}`}
                </div>
              </div>
            </div>
          </section>

          {/* Rincian Keuangan */}
          <section className={panelClass}>
            <h3 className={panelHeadingClass}>Rincian keuangan</h3>
            <div className="max-w-xl divide-y divide-zinc-800 text-sm">
              {[
                { label: 'Subtotal Penjualan', val: report.totalSubtotal, cls: '' },
                { label: 'Service Charge', val: report.totalService, cls: 'text-zinc-400' },
                { label: 'Pajak (Tax)', val: report.totalPajak, cls: 'text-zinc-400' },
                { label: 'Pembulatan', val: report.totalPembulatan, cls: 'text-zinc-400' },
                { label: 'Diskon Diberikan', val: -report.totalDiskon, cls: 'text-red-400' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <span className={`text-zinc-400 ${cls}`}>{label}</span>
                  <span className={`tabular-nums ${cls || 'font-medium text-zinc-200'}`}>{val < 0 ? `- ${fmt(-val)}` : fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-3 text-base font-semibold text-amber-300">
                <span>Total pendapatan</span>
                <span className="tabular-nums">{fmt(report.totalPendapatan)}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-3 xl:grid-cols-5">
              {[
                { label: 'Kas Awal', value: report.openingCash },
                { label: 'Penjualan Tunai', value: report.cashSales },
                { label: 'Penjualan Non Tunai', value: report.nonCashSales },
                { label: 'Kas Keluar', value: -report.expenseCash },
                { label: 'Kas Diharapkan', value: report.expectedCash },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-950/60 p-3">
                  <div className="mb-2 text-xs text-zinc-400">{label}</div>
                  <div className="text-sm font-medium tabular-nums text-zinc-100">{fmt(value)}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Metode Bayar */}
          <section className={panelClass}>
            <h3 className={panelHeadingClass}>Metode pembayaran</h3>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
              {Object.entries(report.byMetode).map(([metode, data]) => (
                <div key={metode} className="bg-zinc-950/60 p-4">
                  <div className="text-sm font-medium text-zinc-200">{metode}</div>
                  <div className="mt-2 text-lg font-semibold tabular-nums text-zinc-100">{fmt(data.total)}</div>
                  <div className="mt-1 text-xs text-zinc-500">{data.count} transaksi</div>
                </div>
              ))}
              {Object.keys(report.byMetode).length === 0 && (
                <div className="text-zinc-500 text-sm italic col-span-3">Tidak ada transaksi.</div>
              )}
            </div>
          </section>

          {/* Shift Summary */}
          {report.shifts.length > 0 && (
            <section className={panelClass}>
              <h3 className={panelHeadingClass}>Ringkasan shift</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-zinc-800 text-xs text-zinc-500">
                    <tr>
                      <th className="py-3 text-left font-medium">Kasir</th>
                      <th className="py-3 text-left font-medium">Buka</th>
                      <th className="py-3 text-left font-medium">Tutup</th>
                      <th className="py-3 text-right font-medium">Kas awal</th>
                      <th className="py-3 text-right font-medium">Penjualan</th>
                      <th className="py-3 text-right font-medium">Kas keluar</th>
                      <th className="py-3 text-right font-medium">Kas dihitung</th>
                      <th className="py-3 text-right font-medium">Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {report.shifts.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-zinc-800/40">
                        <td className="py-3 font-medium text-zinc-200">{s.kasir?.nama}</td>
                        <td className="py-3 tabular-nums text-zinc-400">{new Date(s.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-3 tabular-nums text-zinc-400">{s.waktuTutup ? new Date(s.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : <span className="text-amber-300">Aktif</span>}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">{fmt(s.kasAwal)}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">{fmt(s.totalPenjualan || 0)}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">{fmt(s.pengeluaran)}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">{s.kasHitung === null ? '-' : fmt(s.kasHitung)}</td>
                        <td className={`py-3 text-right font-medium tabular-nums ${s.selisih === null ? 'text-zinc-500' : s.selisih === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {s.selisih === null ? '-' : fmt(s.selisih)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* bySofa Aggregate */}
          {report.bySofa && Object.keys(report.bySofa).length > 0 && (
            <section className={panelClass}>
              <h3 className={panelHeadingClass}>Penjualan per meja/area</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-zinc-800 text-xs text-zinc-500">
                    <tr>
                      <th className="py-3 text-left font-medium">Meja / jenis</th>
                      <th className="py-3 text-right font-medium">Jumlah bill</th>
                      <th className="py-3 text-right font-medium">Rata-rata/bill</th>
                      <th className="py-3 text-right font-medium">Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {Object.entries(report.bySofa)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([key, data]) => (
                        <tr key={key} className="transition-colors hover:bg-zinc-800/40">
                          <td className="py-3 font-medium text-zinc-200">{data.nama}</td>
                          <td className="py-3 text-right tabular-nums text-zinc-300">{data.count}</td>
                          <td className="py-3 text-right tabular-nums text-zinc-400">{fmt(data.average)}</td>
                          <td className="py-3 text-right font-medium tabular-nums text-zinc-100">{fmt(data.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(report.voidItems.length > 0 || report.compItems.length > 0) && (
            <section className={panelClass}>
              <h3 className={panelHeadingClass}>Detail void dan comp</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-zinc-800 text-xs text-zinc-500">
                    <tr>
                      <th className="py-3 text-left font-medium">Tipe</th>
                      <th className="py-3 text-left font-medium">Item</th>
                      <th className="py-3 text-right font-medium">Qty</th>
                      <th className="py-3 text-right font-medium">Nominal</th>
                      <th className="py-3 text-left font-medium">Alasan</th>
                      <th className="py-3 text-left font-medium">Otorisasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {[
                      ...report.voidItems.map((item) => ({ ...item, jenis: "VOID" as const })),
                      ...report.compItems.map((item) => ({ ...item, jenis: "COMP" as const })),
                    ].map((item) => (
                      <tr key={`${item.jenis}-${item.id}`} className="transition-colors hover:bg-zinc-800/40">
                        <td className="py-3">
                          <span className={`rounded px-2 py-1 text-xs font-medium ${item.jenis === "VOID" ? "bg-red-950/40 text-red-300" : "bg-purple-950/40 text-purple-300"}`}>
                            {item.jenis}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-200">{item.namaItem}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">{item.qty}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-200">{fmt(item.harga * item.qty)}</td>
                        <td className="py-3 text-zinc-400">{item.alasanVoidComp || "-"}</td>
                        <td className="py-3 text-zinc-400">{item.otorisasiOleh || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={panelClass}>
            <h3 className={panelHeadingClass}>Daftar transaksi ({report.bills.length})</h3>
            {report.bills.length === 0 ? (
              <p className="text-sm text-zinc-500">Tidak ada transaksi pada tanggal ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-zinc-800 text-xs text-zinc-500">
                    <tr>
                      <th className="py-3 text-left font-medium">No.</th>
                      <th className="py-3 text-left font-medium">Meja/tipe</th>
                      <th className="py-3 text-left font-medium">Kasir</th>
                      <th className="py-3 text-left font-medium">Waktu tutup</th>
                      <th className="py-3 text-left font-medium">Metode</th>
                      <th className="py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {report.bills.map((bill) => (
                      <tr key={bill.id} className="transition-colors hover:bg-zinc-800/40">
                        <td className="py-3 font-mono text-xs text-zinc-500">{bill.nomorBill ? `#${String(bill.nomorBill).padStart(3, "0")}` : "-"}</td>
                        <td className="py-3 text-zinc-200">{bill.sofa?.nama || bill.tipe.replace("_", " ")}</td>
                        <td className="py-3 text-zinc-400">{bill.kasir?.nama || "-"}</td>
                        <td className="py-3 tabular-nums text-zinc-400">{bill.waktuTutup ? new Date(bill.waktuTutup).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                        <td className="py-3 text-zinc-400">{bill.metodeBayar}</td>
                        <td className="py-3 text-right font-medium tabular-nums text-zinc-100">{fmt(bill.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-16 text-zinc-600">
          <TrendingUp className="mx-auto mb-3 h-9 w-9 opacity-40" />
          <p className="text-sm">Pilih tanggal, lalu tampilkan laporan harian.</p>
        </div>
      )}
    </div>
  )
}

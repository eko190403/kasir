"use client"

import { useState, useTransition } from "react"
import { searchRiwayatBill, exportDatabaseToCSV, cancelLunasBill, getActiveRefundShifts } from "@/app/actions"
import { Search, Download, FileText, Printer, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

type SearchResult = Awaited<ReturnType<typeof searchRiwayatBill>>

export default function RiwayatClient() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult["bills"]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean, billId: string, total: number }>({ isOpen: false, billId: '', total: 0 })
  const [cancelAlasan, setCancelAlasan] = useState("")
  const [cancelPin, setCancelPin] = useState("")
  const [refundMethod, setRefundMethod] = useState("TUNAI")
  const [refundReference, setRefundReference] = useState("")
  const [refundShiftId, setRefundShiftId] = useState("")
  const [refundShifts, setRefundShifts] = useState<Awaited<ReturnType<typeof getActiveRefundShifts>>>([])
  const [canceling, setCanceling] = useState(false)

  const doSearch = (q: string, p: number) => {
    startTransition(async () => {
      setHasSearched(true)
      const data = await searchRiwayatBill(q, p)
      setResults(data.bills)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(data.page)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(query, 1)
  }

  const handleDownloadCSV = async () => {
    setDownloading(true)
    try {
      const csv = await exportDatabaseToCSV()
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `Backup_Transaksi_Bar_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setDownloading(false)
    }
  }

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

  const openCancelModal = async (bill: { id: string; total: number }) => {
    setCancelModal({ isOpen: true, billId: bill.id, total: bill.total })
    setRefundMethod("TUNAI")
    setRefundReference("")
    setRefundShiftId("")
    try {
      setRefundShifts(await getActiveRefundShifts())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat shift aktif.")
      setRefundShifts([])
    }
  }

  const handleCancelSubmit = async () => {
    if (!cancelAlasan.trim() || !cancelPin.trim()) {
      toast.warning("Alasan dan PIN Manajer wajib diisi")
      return
    }
    if (refundMethod === "TUNAI" && !refundShiftId) {
      toast.warning("Pilih shift kasir aktif untuk mengembalikan uang tunai.")
      return
    }
    setCanceling(true)
    try {
      await cancelLunasBill(
        cancelModal.billId,
        refundShiftId || null,
        refundMethod,
        refundReference,
        cancelAlasan,
        cancelPin
      )
      toast.success("Refund penuh dicatat dan bill berhasil dibatalkan.")
      setCancelModal({ isOpen: false, billId: '', total: 0 })
      setCancelAlasan("")
      setCancelPin("")
      setRefundReference("")
      doSearch(query, page) // Refresh current page
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses pembatalan bill.")
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleSearch} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <label className="relative min-w-0 flex-1 text-xs text-zinc-400">
              Cari transaksi
              <Search className="absolute left-3 top-[2.15rem] h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Masukkan nomor bill atau ID bill"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-white transition-colors placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {isPending ? "Mencari..." : "Cari"}
              </button>
              {!hasSearched && (
                <button
                  type="button"
                  onClick={() => doSearch("", 1)}
                  disabled={isPending}
                  className="h-10 whitespace-nowrap rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                >
                  Semua transaksi
                </button>
              )}
            </div>
          </form>
          <button
            onClick={handleDownloadCSV}
            disabled={downloading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Mengunduh..." : "Ekspor CSV"}
          </button>
        </div>
      </section>

      {/* Results */}
      {!hasSearched ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-5 py-10 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-300">Cari nomor bill atau tampilkan semua transaksi.</p>
          <p className="mt-1 text-sm text-zinc-500">Hasil pencarian akan ditampilkan di sini.</p>
        </div>
      ) : (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-1 border-b border-zinc-800 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                <FileText className="h-4 w-4 text-zinc-400" />
                Hasil transaksi
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {total === 0 ? "Tidak ada transaksi ditemukan" : `Menampilkan ${results.length} dari ${total} transaksi`}
              </p>
            </div>
            {totalPages > 0 && (
              <span className="text-xs tabular-nums text-zinc-500">Halaman {page} dari {totalPages}</span>
            )}
          </div>

          {isPending ? (
            <div className="py-12 text-center text-sm text-zinc-500">Memuat transaksi...</div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-zinc-300">Transaksi tidak ditemukan.</p>
              <p className="mt-1 text-sm text-zinc-500">
                {query ? `Tidak ada bill lunas yang cocok dengan “${query}”.` : "Belum ada bill lunas untuk ditampilkan."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b border-zinc-800 text-xs text-zinc-500">
                    <tr>
                      <th className="py-3 text-left font-medium">No. bill</th>
                      <th className="py-3 text-left font-medium">Waktu tutup</th>
                      <th className="py-3 text-left font-medium">Kasir</th>
                      <th className="py-3 text-left font-medium">Tipe/meja</th>
                      <th className="py-3 text-left font-medium">Metode</th>
                      <th className="py-3 text-right font-medium">Total</th>
                      <th className="py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {results.map(b => (
                      <tr key={b.id} className="transition-colors hover:bg-zinc-800/40">
                        <td className="py-3 font-mono text-xs font-medium text-zinc-200">
                          {b.nomorBill ? `#${String(b.nomorBill).padStart(3,'0')}` : b.id.split('-')[0].toUpperCase()}
                        </td>
                        <td className="py-3 tabular-nums text-zinc-400">
                          {b.waktuTutup ? new Date(b.waktuTutup).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="py-3 text-zinc-300">{b.kasir?.nama || '-'}</td>
                        <td className="py-3 text-zinc-300">{b.sofa?.nama || b.tipe.replace('_', ' ')}</td>
                        <td className="py-3 text-zinc-400">{b.metodeBayar || '-'}</td>
                        <td className="py-3 text-right font-medium tabular-nums text-zinc-100">{fmt(b.total)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => void openCancelModal(b)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-900/70 px-2.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-950/50"
                              title="Batal / Koreksi"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> Koreksi
                            </button>
                            <a
                              href={`/print/receipt/${b.id}?metode=${b.metodeBayar}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                            >
                              <Printer className="h-3.5 w-3.5" /> Cetak
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
                  <button
                    onClick={() => doSearch(query, page - 1)}
                    disabled={page <= 1 || isPending}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Sebelumnya
                  </button>
                  <span className="text-sm tabular-nums text-zinc-400">{page} / {totalPages}</span>
                  <button
                    onClick={() => doSearch(query, page + 1)}
                    disabled={page >= totalPages || isPending}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Cancel Modal */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-bill-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900">
            <div className="border-b border-zinc-800 p-4">
              <h3 id="cancel-bill-title" className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                <AlertTriangle className="h-4 w-4 text-red-300" />
                Batalkan bill lunas
              </h3>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <p className="text-sm leading-6 text-zinc-400">
                Refund wajib penuh sebesar <strong className="text-white">{fmt(cancelModal.total)}</strong>. Bill hanya berubah menjadi BATAL setelah refund tersimpan. Refund tunai mengurangi kas fisik shift yang dipilih.
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Metode refund</label>
                <select
                  value={refundMethod}
                  onChange={e => setRefundMethod(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  {["TUNAI", "KARTU", "QRIS", "DEBIT", "TRANSFER"].map(method => <option key={method} value={method}>{method}</option>)}
                </select>
              </div>

              {refundMethod !== "TUNAI" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Referensi refund</label>
                  <input
                    type="text"
                    value={refundReference}
                    onChange={e => setRefundReference(e.target.value)}
                    placeholder="Nomor referensi transaksi refund"
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Shift Kasir {refundMethod === "TUNAI" ? "(wajib untuk refund tunai)" : "(opsional)"}
                </label>
                <select
                  value={refundShiftId}
                  onChange={e => setRefundShiftId(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Tidak dikaitkan ke shift</option>
                  {refundShifts.map(shift => (
                    <option key={shift.id} value={shift.id}>
                      {shift.kasir.nama} — mulai {new Date(shift.waktuBuka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </option>
                  ))}
                </select>
                {refundMethod === "TUNAI" && refundShifts.length === 0 && (
                  <p className="mt-2 text-xs text-amber-400">Tidak ada shift aktif. Buka shift kasir sebelum mencatat refund tunai.</p>
                )}
              </div>
              
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Alasan koreksi / batal</label>
                <input 
                  type="text" 
                  value={cancelAlasan} 
                  onChange={e => setCancelAlasan(e.target.value)}
                  placeholder="Misal: Salah input metode bayar"
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">PIN manajer</label>
                <input 
                  type="password" 
                  value={cancelPin} 
                  onChange={e => setCancelPin(e.target.value)}
                  placeholder="Masukkan 6 digit PIN"
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
                <button 
                  onClick={() => setCancelModal({ isOpen: false, billId: '', total: 0 })}
                  disabled={canceling}
                  className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                >
                  Tutup
                </button>
                <button 
                  onClick={handleCancelSubmit}
                  disabled={canceling}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {canceling ? 'Memproses...' : 'Batalkan Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

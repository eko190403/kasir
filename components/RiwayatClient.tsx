"use client"

import { useState, useTransition } from "react"
import { searchRiwayatBill, exportDatabaseToCSV } from "@/app/actions"
import { Search, Download, FileText, Printer, ChevronLeft, ChevronRight } from "lucide-react"

export default function RiwayatClient() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Nomor Bill (contoh: 12), atau kosongkan untuk semua..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition text-white"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50"
          >
            {isPending ? "Mencari..." : "Cari"}
          </button>
          {!hasSearched && (
            <button
              type="button"
              onClick={() => doSearch("", 1)}
              disabled={isPending}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition disabled:opacity-50 whitespace-nowrap"
            >
              Tampilkan Semua
            </button>
          )}
        </form>

        <button
          onClick={handleDownloadCSV}
          disabled={downloading}
          className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          <Download className="w-5 h-5" />
          {downloading ? "Mengunduh..." : "Export Semua (CSV)"}
        </button>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-400" />
              Hasil Pencarian
            </h2>
            {total > 0 && (
              <span className="text-xs text-zinc-500">
                Menampilkan {results.length} dari <span className="text-white font-bold">{total}</span> tagihan
              </span>
            )}
          </div>

          {isPending ? (
            <div className="py-12 text-center text-zinc-500">Memuat data...</div>
          ) : results.length === 0 ? (
            <div className="text-zinc-500 italic text-center py-8">
              Tidak ditemukan tagihan Lunas {query ? `dengan kata kunci "${query}"` : ''}.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="text-left pb-3">No. Bill</th>
                      <th className="text-left pb-3">Waktu Tutup</th>
                      <th className="text-left pb-3">Kasir</th>
                      <th className="text-left pb-3">Tipe/Meja</th>
                      <th className="text-left pb-3">Metode</th>
                      <th className="text-right pb-3">Total</th>
                      <th className="text-right pb-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {results.map(b => (
                      <tr key={b.id} className="hover:bg-zinc-800/40 transition">
                        <td className="py-3 font-mono text-emerald-400 font-bold">
                          {b.nomorBill ? `#${String(b.nomorBill).padStart(3,'0')}` : b.id.split('-')[0].toUpperCase()}
                        </td>
                        <td className="py-3 text-zinc-400 text-xs">
                          {new Date(b.waktuTutup).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 text-zinc-300">{b.kasir?.nama || '-'}</td>
                        <td className="py-3">{b.sofa?.nama || b.tipe.replace('_', ' ')}</td>
                        <td className="py-3">
                          <span className="text-xs px-2 py-1 bg-zinc-800 rounded-md">
                            {b.metodeBayar || '-'}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold text-white">
                          {fmt(b.total)}
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href={`/print/receipt/${b.id}?metode=${b.metodeBayar}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs font-bold transition"
                          >
                            <Printer className="w-3 h-3" /> Cetak
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => doSearch(query, page - 1)}
                    disabled={page <= 1 || isPending}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm font-medium"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Sebelumnya
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => doSearch(query, p)}
                        disabled={isPending}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition ${
                          p === page
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => doSearch(query, page + 1)}
                    disabled={page >= totalPages || isPending}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm font-medium"
                  >
                    Berikutnya
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

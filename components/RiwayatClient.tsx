"use client"

import { useState } from "react"
import { searchRiwayatBill, exportDatabaseToCSV } from "@/app/actions"
import { Search, Download, FileText, Printer } from "lucide-react"

export default function RiwayatClient() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setHasSearched(true)
    try {
      const data = await searchRiwayatBill(query)
      setResults(data)
    } finally {
      setLoading(false)
    }
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
              placeholder="Cari Nomor Bill (contoh: 12) atau ID..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50"
          >
            {loading ? "Mencari..." : "Cari"}
          </button>
        </form>

        <button
          onClick={handleDownloadCSV}
          disabled={downloading}
          className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          <Download className="w-5 h-5" />
          {downloading ? "Mengunduh..." : "Export Semua Data (CSV)"}
        </button>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-zinc-400" />
            Hasil Pencarian
          </h2>

          {results.length === 0 ? (
            <div className="text-zinc-500 italic text-center py-8">
              Tidak ditemukan tagihan Lunas dengan kata kunci "{query}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="text-left pb-2">No. Bill</th>
                    <th className="text-left pb-2">Waktu Tutup</th>
                    <th className="text-left pb-2">Kasir</th>
                    <th className="text-left pb-2">Tipe/Meja</th>
                    <th className="text-left pb-2">Metode</th>
                    <th className="text-right pb-2">Total</th>
                    <th className="text-right pb-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {results.map(b => (
                    <tr key={b.id} className="hover:bg-zinc-800/50">
                      <td className="py-2 font-mono text-emerald-400 font-bold">
                        {b.nomorBill ? `#${String(b.nomorBill).padStart(3,'0')}` : b.id.split('-')[0].toUpperCase()}
                      </td>
                      <td className="py-2 text-zinc-400">
                        {new Date(b.waktuTutup).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 text-zinc-300">{b.kasir?.nama || '-'}</td>
                      <td className="py-2">{b.sofa?.nama || b.tipe.replace('_', ' ')}</td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-1 bg-zinc-800 rounded">
                          {b.metodeBayar}
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold text-white">
                        {fmt(b.total)}
                      </td>
                      <td className="py-2 text-right">
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
          )}
        </div>
      )}
    </div>
  )
}

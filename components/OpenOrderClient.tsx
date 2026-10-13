"use client"

import Link from "next/link"
import { useState } from "react"
import { Search, ShoppingBag, Armchair, Clock, Filter } from "lucide-react"

type Bill = {
  id: string
  tipe: string
  sofaId: string | null
  waktuBuka: Date
  subtotal: number
  nomorBill: number | null
  sofa: { nama: string } | null
  billItems: { id: string; qty: number; namaItem: string; harga: number }[]
}

export default function OpenOrderClient({ bills }: { bills: Bill[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"SEMUA" | "DINE_IN" | "TAKE_AWAY">("SEMUA")

  const filtered = bills.filter(bill => {
    const matchSearch = search === "" ||
      bill.sofa?.nama.toLowerCase().includes(search.toLowerCase()) ||
      bill.billItems.some(i => i.namaItem.toLowerCase().includes(search.toLowerCase())) ||
      (bill.nomorBill?.toString() ?? "").includes(search)
    const matchFilter = filter === "SEMUA" || bill.tipe === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Cari nama meja, menu, atau nomor bill..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
        <div className="flex gap-2">
          {(["SEMUA", "DINE_IN", "TAKE_AWAY"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-2 text-xs font-medium transition-colors ${filter === f ? 'border-amber-700 bg-amber-950/40 text-amber-200' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'}`}
            >
              {f === "DINE_IN" && <Armchair className="w-3.5 h-3.5" />}
              {f === "TAKE_AWAY" && <ShoppingBag className="w-3.5 h-3.5" />}
              {f === "SEMUA" && <Filter className="w-3.5 h-3.5" />}
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-zinc-500">
        Menampilkan <span className="font-bold text-white">{filtered.length}</span> dari {bills.length} tagihan terbuka
      </p>

      {filtered.length === 0 ? (
        <div className="text-zinc-500 italic text-center py-16">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Tidak ada tagihan yang cocok dengan pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(bill => (
            <Link
              key={bill.id}
              href={bill.sofaId ? `/sofa/${bill.sofaId}` : `/bill/${bill.id}`}
              className="group flex cursor-pointer flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-600"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {bill.tipe === "DINE_IN"
                      ? <Armchair className="w-4 h-4 text-amber-400" />
                      : <ShoppingBag className="w-4 h-4 text-amber-400" />
                    }
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {bill.sofa?.nama || `Take Away`}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="w-3 h-3" />
                    {new Date(bill.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    {bill.nomorBill && (
                      <span className="ml-2 px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-zinc-400">
                        #{bill.nomorBill.toString().padStart(3, '0')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-400">
                  {bill.tipe === "DINE_IN" ? "Makan di tempat" : "Bawa pulang"}
                </div>
              </div>

              <div className="flex-1 space-y-1 mb-3 border-t border-zinc-800 pt-3">
                {bill.billItems.slice(0, 3).map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-zinc-400 truncate pr-2">{item.qty}x {item.namaItem}</span>
                    <span className="text-zinc-300 shrink-0">Rp {(item.harga * item.qty).toLocaleString('id-ID')}</span>
                  </div>
                ))}
                {bill.billItems.length > 3 && (
                  <div className="text-xs text-zinc-600 italic">+ {bill.billItems.length - 3} item lainnya...</div>
                )}
                {bill.billItems.length === 0 && (
                  <div className="text-xs text-zinc-600 italic">Belum ada pesanan</div>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
                <span className="text-xs text-zinc-500">{bill.billItems.length} item</span>
                <span className="text-lg font-bold text-white">
                  Rp {bill.subtotal.toLocaleString('id-ID')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

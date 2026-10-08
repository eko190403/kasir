"use client"

import { useMemo, useState } from "react"
import { createReservasi, updateReservasiStatus } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function ReservasiClient({ reservasis, sofas }: { reservasis: any[], sofas: any[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ sofaId: '', nama: '', jam: '', jumlahOrang: 2, deposit: 0 })

  const filteredReservasis = useMemo(() => {
    return reservasis.filter((item) => {
      const matchesStatus = filter === 'ALL' || item.status === filter
      const matchesSearch = item.nama.toLowerCase().includes(search.toLowerCase()) ||
        item.sofa?.nama?.toLowerCase().includes(search.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [reservasis, filter, search])

  const stats = {
    pending: reservasis.filter(r => r.status === 'PENDING').length,
    confirmed: reservasis.filter(r => r.status === 'CONFIRMED').length,
    completed: reservasis.filter(r => r.status === 'COMPLETED').length,
  }

  const handleSubmit = async () => {
    if (!form.sofaId || !form.nama || !form.jam) {
      toast.warning("Mohon lengkapi semua field")
      return
    }
    setLoading(true)
    try {
      await createReservasi(form.sofaId, form.nama, form.jam, form.jumlahOrang, form.deposit || undefined)
      setShowForm(false)
      setForm({ sofaId: '', nama: '', jam: '', jumlahOrang: 2, deposit: 0 })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatus = async (id: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') => {
    setLoading(true)
    try {
      await updateReservasiStatus(id, status)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-amber-700/40 p-4 rounded-xl">
          <p className="text-xs uppercase text-zinc-400">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
        </div>
        <div className="bg-zinc-900 border border-blue-700/40 p-4 rounded-xl">
          <p className="text-xs uppercase text-zinc-400">Confirmed</p>
          <p className="text-2xl font-bold text-blue-400">{stats.confirmed}</p>
        </div>
        <div className="bg-zinc-900 border border-emerald-700/40 p-4 rounded-xl">
          <p className="text-xs uppercase text-zinc-400">Completed</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
        </div>
      </div>

      {!showForm ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition w-fit">
            + Tambah Reservasi
          </button>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau sofa..."
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 max-w-lg">
          <h2 className="font-bold text-lg">Buat Reservasi Baru</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Nama Tamu</label>
              <input type="text" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Sofa</label>
              <select value={form.sofaId} onChange={e => setForm({...form, sofaId: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500">
                <option value="">Pilih Sofa</option>
                {sofas.map(s => <option key={s.id} value={s.id}>{s.nama} ({s.kapasitas} org)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400">Waktu</label>
                <input type="datetime-local" value={form.jam} onChange={e => setForm({...form, jam: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Jumlah Orang</label>
                <input type="number" min="1" value={form.jumlahOrang} onChange={e => setForm({...form, jumlahOrang: parseInt(e.target.value) || 1})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Deposit (Opsional)</label>
              <input type="number" min="0" value={form.deposit} onChange={e => setForm({...form, deposit: parseInt(e.target.value) || 0})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 rounded-lg text-sm font-bold">Simpan</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReservasis.length === 0 ? (
          <div className="text-zinc-500 italic col-span-full bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-6 text-center">
            Belum ada reservasi yang sesuai filter.
          </div>
        ) : (
          filteredReservasis.map(r => {
            const statusColor: Record<string, string> = {
              PENDING: 'bg-amber-600',
              CONFIRMED: 'bg-blue-600',
              CANCELLED: 'bg-red-600',
              COMPLETED: 'bg-emerald-600',
            }
            return (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{r.nama}</h3>
                    <p className="text-sm text-zinc-400">{r.sofa?.nama} • {r.jumlahOrang} orang</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-md ${statusColor[r.status] || 'bg-zinc-700'}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">
                  {new Date(r.jam).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(r.jam).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {r.deposit && r.deposit > 0 && (
                  <p className="text-xs text-emerald-400">Deposit: Rp {r.deposit.toLocaleString('id-ID')}</p>
                )}
                {r.status === 'PENDING' && (
                  <div className="flex gap-2 pt-2 border-t border-zinc-800">
                    <button onClick={() => handleStatus(r.id, 'CONFIRMED')} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 py-1 rounded text-xs font-bold">Konfirmasi</button>
                    <button onClick={() => handleStatus(r.id, 'CANCELLED')} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 py-1 rounded text-xs font-bold">Batal</button>
                  </div>
                )}
                {r.status === 'CONFIRMED' && (
                  <div className="pt-2 border-t border-zinc-800">
                    <button onClick={() => handleStatus(r.id, 'COMPLETED')} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 py-1 rounded text-xs font-bold">Selesai</button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

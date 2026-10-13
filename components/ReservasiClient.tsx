"use client"

import { useMemo, useState } from "react"
import { createReservasi, updateReservasiStatus } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Prisma, ReservasiStatus, Sofa } from "@prisma/client"

type ReservasiWithSofa = Prisma.ReservasiGetPayload<{ include: { sofa: true } }>
type ReservationFilter = "ALL" | ReservasiStatus

const statusLabel: Record<ReservasiStatus, string> = {
  PENDING: "Menunggu",
  CONFIRMED: "Dikonfirmasi",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
}

const statusClass: Record<ReservasiStatus, string> = {
  PENDING: "border-amber-800 bg-amber-950/30 text-amber-300",
  CONFIRMED: "border-blue-800 bg-blue-950/30 text-blue-300",
  CANCELLED: "border-red-900 bg-red-950/30 text-red-300",
  COMPLETED: "border-emerald-900 bg-emerald-950/30 text-emerald-300",
}

const fieldClass = "mt-1 h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"

export default function ReservasiClient({ reservasis, sofas }: { reservasis: ReservasiWithSofa[], sofas: Sofa[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<ReservationFilter>("ALL")
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ sofaId: '', nama: '', noHp: '', jam: '', jumlahOrang: 2, deposit: 0, depositMetode: 'TUNAI' as 'TUNAI' | 'KARTU' | 'QRIS' })

  const filteredReservasis = useMemo(() => {
    return reservasis.filter((item) => {
      const matchesStatus = filter === 'ALL' || item.status === filter
      const normalizedSearch = search.trim().toLowerCase()
      const matchesSearch = item.nama.toLowerCase().includes(normalizedSearch) ||
        item.sofa.nama.toLowerCase().includes(normalizedSearch) ||
        (item.noHp ?? "").includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [reservasis, filter, search])

  const stats = [
    { label: "Menunggu", status: "PENDING" as const },
    { label: "Dikonfirmasi", status: "CONFIRMED" as const },
    { label: "Selesai", status: "COMPLETED" as const },
    { label: "Dibatalkan", status: "CANCELLED" as const },
  ].map(item => ({
    ...item,
    count: reservasis.filter(reservasi => reservasi.status === item.status).length,
  }))

  const handleSubmit = async () => {
    if (!form.sofaId || !form.nama || !form.jam) {
      toast.warning("Mohon lengkapi semua field")
      return
    }
    setLoading(true)
    try {
      await createReservasi(form.sofaId, form.nama, form.jam, form.jumlahOrang, form.deposit || undefined, form.noHp, form.depositMetode)
      setShowForm(false)
      setForm({ sofaId: '', nama: '', noHp: '', jam: '', jumlahOrang: 2, deposit: 0, depositMetode: 'TUNAI' })
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan reservasi.")
    } finally {
      setLoading(false)
    }
  }

  const handleStatus = async (id: string, status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') => {
    setLoading(true)
    try {
      await updateReservasiStatus(id, status)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status reservasi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.status} className="bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{stat.count}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="text-xs text-zinc-400">
              Cari reservasi
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Nama, nomor telepon, atau sofa"
                className={`${fieldClass} sm:w-72`}
              />
            </label>
            <label className="text-xs text-zinc-400">
              Status
              <select
                value={filter}
                onChange={event => setFilter(event.target.value as ReservationFilter)}
                className={`${fieldClass} sm:w-48`}
              >
                <option value="ALL">Semua status</option>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() => setShowForm(current => !current)}
            className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500"
          >
            {showForm ? "Tutup formulir" : "Tambah reservasi"}
          </button>
        </div>
      </section>

      {showForm && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="mb-4 border-b border-zinc-800 pb-3">
            <h2 className="text-base font-semibold text-zinc-100">Reservasi baru</h2>
            <p className="mt-1 text-sm text-zinc-500">Isi detail tamu, waktu, dan area yang dipesan.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-zinc-400">
              Nama tamu
              <input required type="text" value={form.nama} onChange={event => setForm({ ...form, nama: event.target.value })} className={fieldClass} />
            </label>
            <label className="text-xs text-zinc-400">
              Nomor telepon <span className="text-zinc-600">(opsional)</span>
              <input type="tel" value={form.noHp} onChange={event => setForm({ ...form, noHp: event.target.value })} className={fieldClass} />
            </label>
            <label className="text-xs text-zinc-400">
              Sofa / area
              <select required value={form.sofaId} onChange={event => setForm({ ...form, sofaId: event.target.value })} className={fieldClass}>
                <option value="">Pilih area</option>
                {sofas.map(sofa => <option key={sofa.id} value={sofa.id}>{sofa.nama} · {sofa.kapasitas} orang</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Tanggal dan waktu
              <input required type="datetime-local" value={form.jam} onChange={event => setForm({ ...form, jam: event.target.value })} className={fieldClass} />
            </label>
            <label className="text-xs text-zinc-400">
              Jumlah orang
              <input type="number" min="1" value={form.jumlahOrang} onChange={event => setForm({ ...form, jumlahOrang: parseInt(event.target.value) || 1 })} className={fieldClass} />
            </label>
            <label className="text-xs text-zinc-400">
              Deposit <span className="text-zinc-600">(opsional)</span>
              <input type="number" min="0" value={form.deposit} onChange={event => setForm({ ...form, deposit: parseInt(event.target.value) || 0 })} className={fieldClass} />
            </label>
            {form.deposit > 0 && (
              <label className="text-xs text-zinc-400">
                Metode pembayaran deposit
                <select value={form.depositMetode} onChange={event => setForm({ ...form, depositMetode: event.target.value as typeof form.depositMetode })} className={fieldClass}>
                  <option value="TUNAI">Tunai</option>
                  <option value="KARTU">Kartu</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </label>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button onClick={() => setShowForm(false)} className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800">Batal</button>
            <button onClick={handleSubmit} disabled={loading} className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan reservasi"}</button>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">Daftar reservasi</h2>
        <span className="text-xs tabular-nums text-zinc-500">{filteredReservasis.length} dari {reservasis.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredReservasis.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-800 px-5 py-10 text-center">
            <p className="text-sm font-medium text-zinc-300">Tidak ada reservasi ditemukan.</p>
            <p className="mt-1 text-sm text-zinc-500">Ubah pencarian atau filter status untuk melihat hasil lain.</p>
          </div>
        ) : (
          filteredReservasis.map(r => {
            return (
              <article key={r.id} className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-zinc-100">{r.nama}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{r.sofa.nama} <span className="text-zinc-600">·</span> {r.jumlahOrang} orang</p>
                  </div>
                  <span className={`shrink-0 rounded border px-2 py-1 text-xs font-medium ${statusClass[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </div>
                <p className="mt-4 border-t border-zinc-800 pt-3 text-sm tabular-nums text-zinc-300">
                  {new Date(r.jam).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  <span className="mx-2 text-zinc-600">·</span>
                  {new Date(r.jam).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {r.noHp && <p className="mt-2 text-xs text-zinc-500">Telepon: {r.noHp}</p>}
                {r.deposit && r.deposit > 0 && (
                  <p className="mt-2 text-sm text-zinc-300">
                    Deposit <span className="font-medium tabular-nums text-zinc-100">Rp {r.deposit.toLocaleString('id-ID')}</span>
                    <span className="text-zinc-500"> · {r.depositMetode || 'metode lama'}</span>
                    {r.billId ? <span className="text-emerald-300"> · diterapkan ke bill</span> : null}
                  </p>
                )}
                {r.status === 'PENDING' && (
                  <div className="mt-auto flex gap-2 border-t border-zinc-800 pt-3">
                    <button onClick={() => handleStatus(r.id, 'CONFIRMED')} disabled={loading} className="h-9 flex-1 rounded-md bg-amber-600 px-3 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50">Konfirmasi</button>
                    <button onClick={() => handleStatus(r.id, 'CANCELLED')} disabled={loading} className="h-9 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:border-red-900 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50">Batalkan</button>
                  </div>
                )}
                {r.status === 'CONFIRMED' && (
                  <div className="mt-auto border-t border-zinc-800 pt-3">
                    <button onClick={() => handleStatus(r.id, 'COMPLETED')} disabled={loading} className="h-9 w-full rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-200 transition-colors hover:border-emerald-900 hover:bg-emerald-950/40 hover:text-emerald-300 disabled:opacity-50">Tandai selesai</button>
                  </div>
                )}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}

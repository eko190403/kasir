"use client"

import { toggleMenuAvailability, addMenuItem, editMenuItem, deleteMenuItem } from "@/app/actions"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Utensils, Coffee, Edit, Trash2, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import type { MenuItem, MenuKategori } from "@prisma/client"

type CategoryFilter = "SEMUA" | MenuKategori
type AvailabilityFilter = "SEMUA" | "TERSEDIA" | "HABIS"

const fieldClass = "h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white focus:border-amber-500 focus:outline-none"

export default function MenuClient({ menuItems }: { menuItems: MenuItem[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("SEMUA")
  const [statusFilter, setStatusFilter] = useState<AvailabilityFilter>("SEMUA")

  // Form State
  const [nama, setNama] = useState("")
  const [harga, setHarga] = useState("")
  const [kategori, setKategori] = useState<"MAKANAN" | "MINUMAN">("MINUMAN")

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch = item.nama.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === "SEMUA" || item.kategori === categoryFilter
      const matchesStatus =
        statusFilter === "SEMUA" ||
        (statusFilter === "TERSEDIA" && item.tersedia) ||
        (statusFilter === "HABIS" && !item.tersedia)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [menuItems, search, categoryFilter, statusFilter])

  const handleToggle = async (id: string) => {
    setLoading(id)
    try {
      await toggleMenuAvailability(id)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah ketersediaan menu.")
    } finally {
      setLoading(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading("submit")
    try {
      if (editId) {
        await editMenuItem(editId, nama, parseInt(harga) || 0, kategori)
        toast.success('Menu berhasil diubah!')
      } else {
        await addMenuItem(nama, parseInt(harga) || 0, kategori)
        toast.success('Menu baru berhasil ditambahkan!')
      }
      resetForm()
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan menu.")
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus menu ini?")) return
    setLoading(id)
    try {
      await deleteMenuItem(id)
      toast.success('Menu berhasil dihapus.')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus menu.")
    } finally {
      setLoading(null)
    }
  }

  const resetForm = () => {
    setShowAddForm(false)
    setEditId(null)
    setNama("")
    setHarga("")
    setKategori("MINUMAN")
  }

  const startEdit = (item: MenuItem) => {
    setEditId(item.id)
    setNama(item.nama)
    setHarga(item.harga.toString())
    setKategori(item.kategori)
    setShowAddForm(true)
  }

  const clearFilters = () => {
    setSearch("")
    setCategoryFilter("SEMUA")
    setStatusFilter("SEMUA")
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative text-xs text-zinc-400">
              Cari menu
              <Search className="absolute left-3 top-[2.15rem] h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Nama menu"
                className={`${fieldClass} mt-1 w-full pl-9 sm:w-64`}
              />
            </label>
            <label className="text-xs text-zinc-400">
              Kategori
              <select
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value as CategoryFilter)}
                className={`${fieldClass} mt-1 w-full sm:w-40`}
              >
                <option value="SEMUA">Semua kategori</option>
                <option value="MAKANAN">Makanan</option>
                <option value="MINUMAN">Minuman</option>
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Ketersediaan
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as AvailabilityFilter)}
                className={`${fieldClass} mt-1 w-full sm:w-40`}
              >
                <option value="SEMUA">Semua status</option>
                <option value="TERSEDIA">Tersedia</option>
                <option value="HABIS">Habis</option>
              </select>
            </label>
            {(search || categoryFilter !== "SEMUA" || statusFilter !== "SEMUA") && (
              <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1 self-end px-2 text-sm text-zinc-400 transition-colors hover:text-white">
                <X className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500"
          >
            <Plus className="h-4 w-4" /> Tambah menu
          </button>
        </div>
      </section>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="mb-4 border-b border-zinc-800 pb-3">
            <h2 className="text-base font-semibold text-zinc-100">{editId ? "Ubah menu" : "Menu baru"}</h2>
            <p className="mt-1 text-sm text-zinc-500">Lengkapi nama, harga, dan kategori.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-zinc-400">
              Nama menu
              <input required type="text" value={nama} onChange={event => setNama(event.target.value)} className={`${fieldClass} mt-1 w-full`} />
            </label>
            <label className="text-xs text-zinc-400">
              Harga (Rp)
              <input required type="number" min="0" value={harga} onChange={event => setHarga(event.target.value)} className={`${fieldClass} mt-1 w-full`} />
            </label>
            <label className="text-xs text-zinc-400">
              Kategori
              <select value={kategori} onChange={event => setKategori(event.target.value as MenuKategori)} className={`${fieldClass} mt-1 w-full`}>
                <option value="MINUMAN">Minuman</option>
                <option value="MAKANAN">Makanan</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button type="button" onClick={resetForm} className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800">Batal</button>
            <button type="submit" disabled={loading === "submit"} className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50">{loading === "submit" ? "Menyimpan..." : "Simpan menu"}</button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">Daftar menu</h2>
        <span className="text-xs tabular-nums text-zinc-500">{filteredMenuItems.length} dari {menuItems.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredMenuItems.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-800 px-5 py-10 text-center">
            <p className="text-sm font-medium text-zinc-300">Tidak ada menu ditemukan.</p>
            <p className="mt-1 text-sm text-zinc-500">Ubah pencarian atau filter untuk melihat menu lain.</p>
          </div>
        ) : (
          filteredMenuItems.map(item => (
            <article key={item.id} className="flex min-h-44 flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold text-zinc-100">{item.nama}</h3>
                  <p className="mt-2 text-lg font-medium tabular-nums text-zinc-100">Rp {item.harga.toLocaleString('id-ID')}</p>
                </div>
                <button
                  onClick={() => handleToggle(item.id)}
                  disabled={loading === item.id}
                  className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${item.tersedia
                    ? 'border-emerald-900 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/60'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {loading === item.id ? "Memperbarui..." : item.tersedia ? 'Tersedia' : 'Habis'}
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  {item.kategori === 'MAKANAN' ? <Utensils className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
                  {item.kategori === 'MAKANAN' ? "Makanan" : "Minuman"}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(item)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
                    <Edit className="h-3.5 w-3.5" /> Ubah
                  </button>
                  <button onClick={() => handleDelete(item.id)} disabled={loading === item.id} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

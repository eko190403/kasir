"use client"

import { toggleMenuAvailability, addMenuItem, editMenuItem, deleteMenuItem } from "@/app/actions"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Utensils, Coffee, Edit, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"

export default function MenuClient({ menuItems }: { menuItems: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [nama, setNama] = useState("")
  const [harga, setHarga] = useState("")
  const [kategori, setKategori] = useState<"MAKANAN" | "MINUMAN">("MINUMAN")

  const handleToggle = async (id: string) => {
    setLoading(id)
    try {
      await toggleMenuAvailability(id)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
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
    } catch (err: any) {
      toast.error(err.message)
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
    } catch (err: any) {
      toast.error(err.message)
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

  const startEdit = (item: any) => {
    setEditId(item.id)
    setNama(item.nama)
    setHarga(item.harga.toString())
    setKategori(item.kategori)
    setShowAddForm(true)
  }

  return (
    <div className="space-y-6">
      {!showAddForm ? (
        <button 
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Menu Baru
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 max-w-md">
          <h2 className="font-bold text-lg">{editId ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Nama Menu</label>
            <input required type="text" value={nama} onChange={e => setNama(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Harga (Rp)</label>
            <input required type="number" min="0" value={harga} onChange={e => setHarga(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Kategori</label>
            <select value={kategori} onChange={e => setKategori(e.target.value as any)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500">
              <option value="MINUMAN">MINUMAN</option>
              <option value="MAKANAN">MAKANAN</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
            <button type="submit" disabled={loading === "submit"} className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-sm">Simpan</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menuItems.map(item => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{item.nama}</h3>
                <p className="text-emerald-400 font-medium text-sm">Rp {item.harga.toLocaleString('id-ID')}</p>
                <span className={`text-xs px-2 py-1 rounded-full mt-2 inline-flex items-center gap-1 font-semibold ${item.kategori === 'MAKANAN' ? 'bg-amber-900/50 text-amber-400' : 'bg-blue-900/50 text-blue-400'}`}>
                  {item.kategori === 'MAKANAN' ? <Utensils className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
                  {item.kategori}
                </span>
              </div>
              <button
                onClick={() => handleToggle(item.id)}
                disabled={loading === item.id}
                className={`px-3 py-1 rounded text-xs font-bold transition ${item.tersedia 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                  : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {item.tersedia ? 'Tersedia' : 'Habis'}
              </button>
            </div>
            
            <div className="flex gap-2 border-t border-zinc-800 pt-3 mt-4">
              <button onClick={() => startEdit(item)} className="text-xs text-blue-400 hover:text-blue-300 flex-1 flex items-center gap-1">
                <Edit className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => handleDelete(item.id)} disabled={loading === item.id} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

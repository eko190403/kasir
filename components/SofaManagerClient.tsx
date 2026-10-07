"use client"

import { addSofa, editSofa, deleteSofa } from "@/app/actions"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function SofaManagerClient({ sofas }: { sofas: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [nama, setNama] = useState("")
  const [kapasitas, setKapasitas] = useState("4")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading("submit")
    try {
      if (editId) {
        await editSofa(editId, nama, parseInt(kapasitas) || 1)
      } else {
        await addSofa(nama, parseInt(kapasitas) || 1)
      }
      toast.success(editId ? 'Data meja berhasil diubah!' : 'Meja baru berhasil ditambahkan!')
      resetForm()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus area/meja ini?")) return
    setLoading(id)
    try {
      await deleteSofa(id)
      toast.success('Meja berhasil dihapus.')
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
    setKapasitas("4")
  }

  const startEdit = (item: any) => {
    setEditId(item.id)
    setNama(item.nama)
    setKapasitas(item.kapasitas.toString())
    setShowAddForm(true)
  }

  return (
    <div className="space-y-6">
      {!showAddForm ? (
        <button 
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm"
        >
          + Tambah Sofa / Area Baru
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 max-w-md">
          <h2 className="font-bold text-lg">{editId ? 'Edit Meja' : 'Tambah Meja Baru'}</h2>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Nama Meja / Area (misal: VIP 1, Outdoor A)</label>
            <input required type="text" value={nama} onChange={e => setNama(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Kapasitas (Orang)</label>
            <input required type="number" min="1" value={kapasitas} onChange={e => setKapasitas(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
            <button type="submit" disabled={loading === "submit"} className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-sm">Simpan</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sofas.map(sofa => (
          <div key={sofa.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{sofa.nama}</h3>
                <p className="text-zinc-400 text-sm mt-1">Kapasitas: {sofa.kapasitas} pax</p>
                <div className={`text-xs mt-2 font-medium ${
                  sofa.status === 'KOSONG' ? 'text-zinc-500' :
                  sofa.status === 'TERISI' ? 'text-emerald-400' :
                  sofa.status === 'MENUNGGU_MAKANAN' ? 'text-blue-400' : 'text-amber-400'
                }`}>
                  Status: {sofa.status}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 border-t border-zinc-800 pt-3">
              <button onClick={() => startEdit(sofa)} className="text-xs text-blue-400 hover:text-blue-300 flex-1 text-left">Edit</button>
              <button onClick={() => handleDelete(sofa.id)} disabled={loading === sofa.id} className="text-xs text-red-400 hover:text-red-300">Hapus</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

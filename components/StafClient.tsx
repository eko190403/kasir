"use client"

import { addUser, editUser, deleteUser } from "@/app/actions"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

const PERAN_LIST = ["KASIR", "BARTENDER", "DAPUR", "PELAYAN", "MANAJER"]

const PERAN_COLOR: Record<string, string> = {
  KASIR: "bg-emerald-900/50 text-emerald-400",
  BARTENDER: "bg-blue-900/50 text-blue-400",
  DAPUR: "bg-amber-900/50 text-amber-400",
  PELAYAN: "bg-purple-900/50 text-purple-400",
  MANAJER: "bg-red-900/50 text-red-400",
}

export default function StafClient({ users }: { users: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [nama, setNama] = useState("")
  const [peran, setPeran] = useState("KASIR")
  const [pin, setPin] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading("submit")
    try {
      if (editId) {
        await editUser(editId, nama, peran, pin || undefined)
        toast.success('Data staf berhasil diubah!')
      } else {
        if (!pin) throw new Error("PIN wajib diisi untuk staf baru")
        await addUser(nama, peran, pin)
        toast.success(`Staf baru "${nama}" berhasil ditambahkan!`)
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
    if (!confirm("Yakin ingin menghapus staf ini?")) return
    setLoading(id)
    try {
      await deleteUser(id)
      toast.success('Staf berhasil dihapus.')
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
    setPeran("KASIR")
    setPin("")
  }

  const startEdit = (user: any) => {
    setEditId(user.id)
    setNama(user.nama)
    setPeran(user.peran)
    setPin("") // Jangan tampilkan pin lama
    setShowAddForm(true)
  }

  return (
    <div className="space-y-6">
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm"
        >
          + Tambah Staf Baru
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 max-w-md">
          <h2 className="font-bold text-lg">{editId ? "Edit Staf" : "Tambah Staf Baru"}</h2>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Nama Lengkap</label>
            <input
              required type="text" value={nama}
              onChange={e => setNama(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Jabatan / Peran</label>
            <select
              value={peran} onChange={e => setPeran(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
            >
              {PERAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">PIN Login (6 digit)</label>
            <input
              type="password" value={pin}
              placeholder={editId ? "Kosongkan jika tidak ingin mengubah PIN" : "Masukkan PIN"}
              onChange={e => setPin(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
            <button type="submit" disabled={loading === "submit"} className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-sm">
              Simpan
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <div key={user.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="font-bold text-lg">{user.nama}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block font-medium ${PERAN_COLOR[user.peran] || 'bg-zinc-800 text-zinc-400'}`}>
                {user.peran}
              </span>
            </div>
            <div className="flex gap-2 border-t border-zinc-800 pt-3">
              <button onClick={() => startEdit(user)} className="text-xs text-blue-400 hover:text-blue-300 flex-1 text-left">Edit</button>
              <button onClick={() => handleDelete(user.id)} disabled={loading === user.id} className="text-xs text-red-400 hover:text-red-300">Hapus</button>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="col-span-3 text-zinc-500 italic text-sm py-8 text-center">
            Belum ada data staf. Klik tombol di atas untuk menambahkan.
          </div>
        )}
      </div>
    </div>
  )
}

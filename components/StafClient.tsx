"use client"

import { addUser, editUser, deleteUser } from "@/app/actions"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { Peran, User } from "@prisma/client"
import { Search, Plus, Pencil, Trash2 } from "lucide-react"

const PERAN_LIST: Peran[] = ["KASIR", "BARTENDER", "DAPUR", "PELAYAN", "MANAJER"]

const ROLE_LABEL: Record<Peran, string> = {
  KASIR: "Kasir",
  BARTENDER: "Bartender",
  DAPUR: "Dapur",
  PELAYAN: "Pelayan",
  MANAJER: "Manajer",
}

const fieldClass = "mt-1 h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
type StaffAccount = Pick<User, "id" | "nama" | "peran">

export default function StafClient({ users }: { users: StaffAccount[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"SEMUA" | Peran>("SEMUA")

  const [nama, setNama] = useState("")
  const [peran, setPeran] = useState<Peran>("KASIR")
  const [pin, setPin] = useState("")

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return users.filter(user =>
      (roleFilter === "SEMUA" || user.peran === roleFilter) &&
      user.nama.toLowerCase().includes(normalizedSearch)
    )
  }, [users, search, roleFilter])

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan akun staf.")
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus akun staf.")
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

  const startEdit = (user: StaffAccount) => {
    setEditId(user.id)
    setNama(user.nama)
    setPeran(user.peran)
    setPin("") // Jangan tampilkan pin lama
    setShowAddForm(true)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative text-xs text-zinc-400">
              Cari staf
              <Search className="absolute left-3 top-[2.15rem] h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Nama staf"
                className={`${fieldClass} pl-9 sm:w-64`}
              />
            </label>
            <label className="text-xs text-zinc-400">
              Jabatan
              <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as "SEMUA" | Peran)} className={`${fieldClass} sm:w-48`}>
                <option value="SEMUA">Semua jabatan</option>
                {PERAN_LIST.map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
              </select>
            </label>
          </div>
          <button
            onClick={() => setShowAddForm(current => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? "Tutup formulir" : "Tambah staf"}
          </button>
        </div>
      </section>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="mb-4 border-b border-zinc-800 pb-3">
            <h2 className="text-base font-semibold text-zinc-100">{editId ? "Ubah data staf" : "Staf baru"}</h2>
            <p className="mt-1 text-sm text-zinc-500">Atur nama, jabatan, dan PIN untuk masuk.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-zinc-400">
              Nama lengkap
              <input required type="text" value={nama} onChange={event => setNama(event.target.value)} className={fieldClass} />
            </label>
            <label className="text-xs text-zinc-400">
              Jabatan
              <select value={peran} onChange={event => setPeran(event.target.value as Peran)} className={fieldClass}>
                {PERAN_LIST.map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              PIN login <span className="text-zinc-600">(4–6 digit)</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                maxLength={6}
                required={!editId}
                value={pin}
                placeholder={editId ? "Kosongkan jika tidak diubah" : "Masukkan PIN"}
                onChange={event => setPin(event.target.value.replace(/\D/g, ""))}
                className={fieldClass}
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button type="button" onClick={resetForm} className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800">Batal</button>
            <button type="submit" disabled={loading === "submit"} className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50">{loading === "submit" ? "Menyimpan..." : "Simpan data"}</button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">Daftar staf</h2>
        <span className="text-xs tabular-nums text-zinc-500">{filteredUsers.length} dari {users.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredUsers.map(user => (
          <article key={user.id} className="flex min-h-36 flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-zinc-100">{user.nama}</h3>
                <p className="mt-1 text-xs text-zinc-500">Akun staf</p>
              </div>
              <span className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300">{ROLE_LABEL[user.peran]}</span>
            </div>
            <div className="mt-auto flex justify-end gap-1 border-t border-zinc-800 pt-3">
              <button onClick={() => startEdit(user)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
                <Pencil className="h-3.5 w-3.5" /> Ubah
              </button>
              <button onClick={() => handleDelete(user.id)} disabled={loading === user.id} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            </div>
          </article>
        ))}

        {filteredUsers.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-800 px-5 py-10 text-center">
            <p className="text-sm font-medium text-zinc-300">Tidak ada staf ditemukan.</p>
            <p className="mt-1 text-sm text-zinc-500">{users.length === 0 ? "Tambahkan akun staf untuk mulai mengelola akses." : "Ubah pencarian atau filter jabatan."}</p>
          </div>
        )}
      </div>
    </div>
  )
}

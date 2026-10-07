"use client"

import { useState } from "react"
import { pindahSofa } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function PindahSofaButton({ billId, currentSofaId, sofas }: { billId: string, currentSofaId: string, sofas: any[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const availableSofas = sofas.filter(s => s.id !== currentSofaId && s.status === "KOSONG")

  const handlePindah = async (sofaBaruId: string) => {
    if (!confirm("Yakin pindah sofa?")) return
    setLoading(true)
    try {
      await pindahSofa(billId, sofaBaruId)
      router.push(`/sofa/${sofaBaruId}`)
    } catch (err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
      >
        Pindah Sofa
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-bold text-sm">Pilih Sofa Tujuan</span>
        <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-white">✕ Tutup</button>
      </div>
      {availableSofas.length === 0 ? (
        <p className="text-zinc-500 text-sm italic">Tidak ada sofa kosong.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {availableSofas.map(s => (
            <button
              key={s.id}
              onClick={() => handlePindah(s.id)}
              disabled={loading}
              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 p-3 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {s.nama}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { setSofaStatus } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function SofaStatusToggle({ sofaId, currentStatus }: { sofaId: string, currentStatus: string }) {
  const router = useRouter()
  
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as any
    try {
      await setSofaStatus(sofaId, newStatus)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400">Ubah Status Meja:</span>
      <select 
        value={currentStatus} 
        onChange={handleStatusChange}
        className="bg-zinc-800 border border-zinc-700 rounded p-1 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
      >
        <option value="KOSONG">KOSONG</option>
        <option value="TERISI">TERISI</option>
        <option value="MENUNGGU_MAKANAN">MENUNGGU MAKANAN</option>
        <option value="SIAP_BAYAR">SIAP BAYAR</option>
      </select>
    </div>
  )
}

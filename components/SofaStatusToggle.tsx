"use client"

import { setSofaStatus } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type SofaStatus = "KOSONG" | "TERISI" | "MENUNGGU_MAKANAN" | "SIAP_BAYAR"

export default function SofaStatusToggle({
  sofaId,
  currentStatus,
  hasActiveBill
}: {
  sofaId: string
  currentStatus: SofaStatus
  hasActiveBill: boolean
}) {
  const router = useRouter()
  
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as SofaStatus
    try {
      const result = await setSofaStatus(sofaId, newStatus)
      if (!result.success) {
        toast.warning(result.message)
        return
      }
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
        <option value="KOSONG" disabled={hasActiveBill}>KOSONG</option>
        <option value="TERISI">TERISI</option>
        <option value="MENUNGGU_MAKANAN">MENUNGGU MAKANAN</option>
        <option value="SIAP_BAYAR">SIAP BAYAR</option>
      </select>
      {hasActiveBill && <span className="text-xs text-amber-400">Selesaikan bill terbuka untuk mengosongkan meja.</span>}
    </div>
  )
}

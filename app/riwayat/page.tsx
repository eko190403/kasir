import RiwayatClient from "@/components/RiwayatClient"
import { History } from "lucide-react"

export const instant = false

export default function RiwayatPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">OPERASIONAL</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <History className="h-5 w-5 text-amber-400" />
            Riwayat
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Telusuri dan kelola transaksi yang sudah selesai.</p>
        </div>
      </header>

      <RiwayatClient />
    </main>
  )
}

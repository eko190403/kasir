import { searchRiwayatBill, exportDatabaseToCSV } from "@/app/actions"
import RiwayatClient from "@/components/RiwayatClient"
import { History } from "lucide-react"

export const instant = false

export default async function RiwayatPage() {
  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <History className="w-8 h-8 text-emerald-500" />
            Riwayat Transaksi
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Cari struk tagihan lama yang sudah dibayar, atau unduh seluruh data transaksi.</p>
        </div>
      </header>
      <RiwayatClient />
    </main>
  )
}

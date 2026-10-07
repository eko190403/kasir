import EODReportClient from "@/components/EODReportClient"
import { BarChart2 } from "lucide-react"

export const instant = false

export default async function EODReportPage() {
  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-emerald-500" />
            Laporan Harian (End of Day)
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Ringkasan operasional harian per tanggal. Hanya bisa diakses Manajer.</p>
        </div>
      </header>
      <EODReportClient />
    </main>
  )
}

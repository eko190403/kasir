import EODReportClient from "@/components/EODReportClient"
import { requirePageRole } from "@/lib/page-auth"

export const instant = false

export default async function EODReportPage() {
  await requirePageRole(["MANAJER"])
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">OPERASIONAL</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Laporan harian</h1>
          <p className="mt-1 text-sm text-zinc-400">Ringkasan penjualan, kas, dan aktivitas untuk tanggal yang dipilih.</p>
        </div>
      </header>
      <EODReportClient />
    </main>
  )
}

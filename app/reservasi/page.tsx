import { prisma } from "@/lib/prisma"
import ReservasiClient from "@/components/ReservasiClient"

export const instant = false

export default async function ReservasiPage() {
  const reservasis = await prisma.reservasi.findMany({
    orderBy: { jam: 'asc' },
    include: { sofa: true }
  })

  const sofas = await prisma.sofa.findMany({ orderBy: { nama: 'asc' } })

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <p className="mb-1 text-xs font-medium text-amber-400">OPERASIONAL</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Reservasi</h1>
        <p className="mt-1 text-sm text-zinc-400">Atur jadwal tamu dan pantau status pemesanan area.</p>
      </header>
      <ReservasiClient reservasis={reservasis} sofas={sofas} />
    </main>
  )
}

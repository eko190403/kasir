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
    <main className="container mx-auto p-4 space-y-6">
      <header className="pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Reservasi</h1>
      </header>
      <ReservasiClient reservasis={reservasis} sofas={sofas} />
    </main>
  )
}

import { prisma } from "@/lib/prisma"
import SofaManagerClient from "@/components/SofaManagerClient"

export const instant = false

export default async function SofasPage() {
  const sofas = await prisma.sofa.findMany({
    orderBy: { nama: 'asc' }
  })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Manajemen Meja / Sofa</h1>
        <span className="text-sm text-zinc-400">Total: {sofas.length} area</span>
      </header>
      <SofaManagerClient sofas={sofas} />
    </main>
  )
}

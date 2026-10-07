import { prisma } from "@/lib/prisma"
import ShiftClient from "@/components/ShiftClient"

export const instant = false

export default async function ShiftPage() {
  const shifts = await prisma.shift.findMany({
    orderBy: { waktuBuka: 'desc' },
    include: { kasir: true }
  })

  const users = await prisma.user.findMany({ orderBy: { nama: 'asc' } })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Manajemen Shift</h1>
      </header>
      <ShiftClient shifts={shifts} users={users} />
    </main>
  )
}

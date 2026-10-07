import { prisma } from "@/lib/prisma"
import StafClient from "@/components/StafClient"

export const instant = false

export default async function StafPage() {
  const users = await prisma.user.findMany({ orderBy: { nama: 'asc' } })

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Manajemen Staf</h1>
        <span className="text-sm text-zinc-400">Total: {users.length} orang</span>
      </header>
      <StafClient users={users} />
    </main>
  )
}

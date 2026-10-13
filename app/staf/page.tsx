import { prisma } from "@/lib/prisma"
import StafClient from "@/components/StafClient"

export const instant = false

export default async function StafPage() {
  const users = await prisma.user.findMany({ where: { isDeleted: false }, orderBy: { nama: 'asc' } })

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <p className="mb-1 text-xs font-medium text-amber-400">PENGELOLAAN</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Staf</h1>
        <p className="mt-1 text-sm text-zinc-400">Kelola akun, jabatan, dan PIN login staf.</p>
      </header>
      <p className="text-sm text-zinc-400"><span className="font-medium tabular-nums text-zinc-200">{users.length}</span> akun staf aktif</p>
      <StafClient users={users} />
    </main>
  )
}

import { prisma } from "@/lib/prisma"
import ShiftClient from "@/components/ShiftClient"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const instant = false

export default async function ShiftPage() {
  const session = await getSession()
  const actor = session?.user?.id
    ? await prisma.user.findUnique({
      where: { id: session.user.id, isDeleted: false },
      select: { id: true, peran: true }
    })
    : null
  if (!actor || (actor.peran !== "MANAJER" && actor.peran !== "KASIR")) redirect("/login?next=%2Fshift")
  const currentRole = actor.peran

  const shiftFilter = currentRole === "KASIR" ? { kasirId: actor.id } : {}
  const shifts = await prisma.shift.findMany({
    where: shiftFilter,
    orderBy: { waktuBuka: 'desc' },
    include: {
      kasir: true,
      bills: {
        where: { status: { in: ["LUNAS", "BATAL"] } },
        select: {
          total: true,
          metodeBayar: true,
          payments: {
            select: { metode: true, jumlah: true, status: true }
          }
        }
      },
      refunds: { select: { metode: true, jumlah: true } }
    }
  })

  const users = currentRole === "MANAJER"
    ? await prisma.user.findMany({
      where: { peran: "KASIR", isDeleted: false },
      orderBy: { nama: 'asc' }
    })
    : []

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <p className="mb-1 text-xs font-medium text-amber-400">OPERASIONAL · KAS</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Shift</h1>
        <p className="mt-1 text-sm text-zinc-400">Pantau kasir bertugas, arus kas, dan penutupan shift.</p>
      </header>
      <ShiftClient shifts={shifts} users={users} currentRole={currentRole} currentUserId={actor.id} />
    </main>
  )
}

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
        where: { status: "LUNAS" },
        select: {
          total: true,
          metodeBayar: true,
          payments: {
            select: { metode: true, jumlah: true, status: true }
          }
        }
      }
    }
  })

  const users = currentRole === "MANAJER"
    ? await prisma.user.findMany({
      where: { peran: "KASIR", isDeleted: false },
      orderBy: { nama: 'asc' }
    })
    : []

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Manajemen Shift</h1>
      </header>
      <ShiftClient shifts={shifts} users={users} currentRole={currentRole} currentUserId={actor.id} />
    </main>
  )
}

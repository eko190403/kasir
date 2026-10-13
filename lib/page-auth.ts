import "server-only"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const ROLES = ["PELAYAN", "BARTENDER", "DAPUR", "KASIR", "MANAJER"] as const

export type AppRole = (typeof ROLES)[number]
export type CurrentUser = {
  id: string
  nama: string
  peran: AppRole
}

export async function requirePageRole(allowedRoles: readonly AppRole[]): Promise<CurrentUser> {
  const session = await getSession()
  if (!session?.user.id) redirect("/login")

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, isDeleted: false },
    select: { id: true, nama: true, peran: true }
  })
  if (!user || !ROLES.includes(user.peran as AppRole)) redirect("/")

  const currentUser = { ...user, peran: user.peran as AppRole }
  if (!allowedRoles.includes(currentUser.peran)) redirect("/")
  return currentUser
}

import { cookies } from "next/headers"
import { assertSigningKeyConfigured, decrypt, encrypt } from "@/lib/session-token"

export { decrypt, encrypt }

export async function setSession(user: { id: string, nama: string, peran: string }) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const session = await encrypt({ user, expires })
  const cookieStore = await cookies()
  cookieStore.set("session", session, {
    expires,
    maxAge: 24 * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  })
}

export async function getSession() {
  assertSigningKeyConfigured()
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value
  if (!session) return null
  try {
    return await decrypt(session)
  } catch (err) {
    return null
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

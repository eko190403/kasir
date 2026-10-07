import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

const secretKey = process.env.JWT_SECRET || "super-secret-key-for-kasir-bar"
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key)
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  })
  return payload
}

export async function setSession(user: { id: string, nama: string, peran: string }) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const session = await encrypt({ user, expires })
  const cookieStore = await cookies()
  cookieStore.set("session", session, { expires, httpOnly: true })
}

export async function getSession() {
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

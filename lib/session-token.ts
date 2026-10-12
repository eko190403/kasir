import { SignJWT, jwtVerify, type JWTPayload } from "jose"

export type SessionPayload = JWTPayload & {
  user: {
    id: string
    nama: string
    peran: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getSigningKey() {
  const secret = process.env.JWT_SECRET
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("JWT_SECRET wajib diatur dengan rahasia acak minimal 32 byte.")
  }
  return new TextEncoder().encode(secret)
}

export function assertSigningKeyConfigured() {
  getSigningKey()
}

export async function encrypt(payload: JWTPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSigningKey())
}

export async function decrypt(input: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(input, getSigningKey(), {
    algorithms: ["HS256"],
  })
  const user = payload.user
  if (
    !isRecord(user) ||
    typeof user.id !== "string" ||
    typeof user.nama !== "string" ||
    typeof user.peran !== "string"
  ) {
    throw new Error("Sesi tidak memiliki identitas pengguna yang valid.")
  }
  return {
    ...payload,
    user: { id: user.id, nama: user.nama, peran: user.peran },
  }
}

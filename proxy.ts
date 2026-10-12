import { NextResponse, type NextRequest } from "next/server"
import { decrypt } from "@/lib/session-token"

type Peran = "PELAYAN" | "BARTENDER" | "DAPUR" | "KASIR" | "MANAJER"
const ROLES: Peran[] = ["PELAYAN", "BARTENDER", "DAPUR", "KASIR", "MANAJER"]

function isRole(value: unknown): value is Peran {
  return typeof value === "string" && ROLES.includes(value as Peran)
}

const ACCESS: { prefix: string; roles: Peran[] }[] = [
  { prefix: "/settings", roles: ["MANAJER"] },
  { prefix: "/summary", roles: ["MANAJER"] },
  { prefix: "/staf", roles: ["MANAJER"] },
  { prefix: "/eod-report", roles: ["MANAJER"] },
  { prefix: "/riwayat", roles: ["MANAJER"] },
  { prefix: "/shift", roles: ["MANAJER", "KASIR"] },
  { prefix: "/sofas", roles: ["MANAJER", "KASIR"] },
  { prefix: "/menu", roles: ["MANAJER", "KASIR"] },
  { prefix: "/kitchen", roles: ["DAPUR", "BARTENDER", "MANAJER", "KASIR"] },
  { prefix: "/bar", roles: ["BARTENDER", "MANAJER", "KASIR"] },
  { prefix: "/reservasi", roles: ["MANAJER", "KASIR"] },
]

function inSection(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`)
}

export function safeNextPath(value: string | null, fallback = "/", baseUrl = "http://localhost") {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback

  try {
    const url = new URL(trimmed, baseUrl)
    if (url.origin !== new URL(baseUrl).origin || url.pathname === "/login") return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const nextPath = `${path}${request.nextUrl.search}`
  const token = request.cookies.get("session")?.value
  let session: Awaited<ReturnType<typeof decrypt>> | null = null

  if (token) {
    try {
      session = await decrypt(token)
    } catch {
      session = null
    }
  }

  const user = session?.user
  const role = user?.peran
  const authenticatedRole = isRole(role) ? role : null
  const authenticated = typeof user?.id === "string" && authenticatedRole !== null

  if (path === "/login") {
    if (!authenticated) return NextResponse.next()
    const redirectTarget = safeNextPath(request.nextUrl.searchParams.get("next"), "/", request.url)
    return NextResponse.redirect(new URL(redirectTarget, request.url))
  }

  if (!authenticated) {
    if (path.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 })
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", nextPath)
    return NextResponse.redirect(loginUrl)
  }

  const rule = ACCESS.find(({ prefix }) => inSection(path, prefix))
  if (rule && authenticatedRole && !rule.roles.includes(authenticatedRole)) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|woff2?|ttf|otf)$).*)",
  ],
}

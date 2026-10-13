"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navigationGroups = [
  [
    { href: "/", label: "Beranda" },
    { href: "/open-order", label: "Pesanan aktif" },
    { href: "/reservasi", label: "Reservasi" },
    { href: "/summary", label: "Ringkasan" },
    { href: "/eod-report", label: "Laporan harian" },
    { href: "/riwayat", label: "Riwayat" },
  ],
  [
    { href: "/kitchen", label: "Dapur" },
    { href: "/bar", label: "Bar" },
  ],
  [
    { href: "/menu", label: "Menu" },
    { href: "/sofas", label: "Meja" },
    { href: "/staf", label: "Staf" },
    { href: "/shift", label: "Shift" },
    { href: "/settings", label: "Pengaturan" },
  ],
]

export function MainNavigationFallback() {
  return (
    <nav className="hide-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Navigasi utama">
      {navigationGroups.map((group, groupIndex) => (
        <div key={group[0].href} className="flex shrink-0 items-center gap-0.5">
          {groupIndex > 0 && <div className="mx-1 h-5 w-px bg-zinc-800" />}
          {group.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400"
            >
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

export default function MainNavigation() {
  const pathname = usePathname()

  return (
    <nav className="hide-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Navigasi utama">
      {navigationGroups.map((group, groupIndex) => (
        <div key={group[0].href} className="flex shrink-0 items-center gap-0.5">
          {groupIndex > 0 && <div className="mx-1 h-5 w-px bg-zinc-800" aria-hidden="true" />}
          {group.map(({ href, label }) => {
            const active = href === "/"
              ? pathname === "/"
              : pathname === href
                || pathname.startsWith(`${href}/`)
                || (href === "/sofas" && pathname.startsWith("/sofa/"))

            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-amber-500 text-amber-300"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

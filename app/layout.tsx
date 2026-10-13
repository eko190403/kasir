export const instant = false

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LogoutButton from "@/components/LogoutButton";
import MainNavigation, { MainNavigationFallback } from "@/components/MainNavigation";
import ToasterProvider from "@/components/ToasterProvider";
import AutoLogout from "@/components/AutoLogout";
import { getSession } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Superbar - Sistem Kasir Bar",
  description: "Sistem POS Superbar untuk mengelola pesanan, pembayaran, dan operasional bar",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <html
      lang="id"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        <ToasterProvider />
        {session && <AutoLogout />}
        {session && (
          <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950">
            <div className="container mx-auto px-4 h-14 flex items-center gap-1">
              <Link href="/" className="mr-3 shrink-0 text-base font-semibold tracking-tight text-amber-400">
                Superbar
              </Link>

              <Suspense fallback={<MainNavigationFallback />}>
                <MainNavigation />
              </Suspense>

              <div className="ml-2 flex shrink-0 items-center gap-2 border-l border-zinc-800 pl-3">
                <div className="hidden sm:block text-center">
                  <div className="text-xs font-semibold text-white leading-none">{session.user.nama}</div>
                  <div className="text-[10px] text-zinc-500 leading-none mt-0.5">{session.user.peran}</div>
                </div>
                <LogoutButton />
              </div>
            </div>
          </header>
        )}
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}

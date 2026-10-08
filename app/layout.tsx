export const instant = false

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LogoutButton from "@/components/LogoutButton";
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
  title: "Bar POS - Sistem Kasir Bar",
  description: "Sistem POS untuk manajemen pesanan bar dengan fitur taking order, kitchen display, dan pembayaran",
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
          <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 h-14 flex items-center gap-1">
              {/* Logo */}
              <a href="/" className="text-lg font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mr-3 shrink-0">
                Bar POS
              </a>

              {/* Nav links - scrollable on mobile */}
              <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar flex-1">
                <a href="/" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-emerald-400 transition text-xs font-medium whitespace-nowrap">Beranda</a>
                <a href="/open-order" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-emerald-400 transition text-xs font-medium whitespace-nowrap">Open Order</a>
                <a href="/reservasi" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-emerald-400 transition text-xs font-medium whitespace-nowrap">Reservasi</a>
                <a href="/summary" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-emerald-400 transition text-xs font-medium whitespace-nowrap">Summary</a>
                <a href="/eod-report" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-emerald-400 transition text-xs font-medium whitespace-nowrap">Lap. Harian</a>
                <a href="/riwayat" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-emerald-400 transition text-xs font-medium whitespace-nowrap">Riwayat</a>

                <div className="w-px h-5 bg-zinc-700 mx-1 shrink-0" />

                <a href="/kitchen" className="px-3 py-1.5 rounded-lg hover:bg-amber-900/30 text-amber-400 hover:text-amber-300 transition text-xs font-medium whitespace-nowrap">🍳 Dapur</a>
                <a href="/bar" className="px-3 py-1.5 rounded-lg hover:bg-blue-900/30 text-blue-400 hover:text-blue-300 transition text-xs font-medium whitespace-nowrap">🍹 Bar</a>

                <div className="w-px h-5 bg-zinc-700 mx-1 shrink-0" />

                <a href="/menu" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-medium whitespace-nowrap">Menu</a>
                <a href="/sofas" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-medium whitespace-nowrap">Meja</a>
                <a href="/staf" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-medium whitespace-nowrap">Staf</a>
                <a href="/shift" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-medium whitespace-nowrap">Shift</a>
                <a href="/settings" className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-medium whitespace-nowrap">⚙ Pengaturan</a>
              </div>

              {/* User info + Logout — always visible */}
              <div className="flex items-center gap-2 ml-2 shrink-0 border-l border-zinc-700 pl-3">
                <div className="hidden sm:block text-center">
                  <div className="text-xs font-semibold text-white leading-none">{session.user.nama}</div>
                  <div className="text-[10px] text-zinc-500 leading-none mt-0.5">{session.user.peran}</div>
                </div>
                <LogoutButton />
              </div>
            </div>
          </nav>
        )}
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}

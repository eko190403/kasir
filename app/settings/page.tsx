import { prisma } from "@/lib/prisma"
import SettingsClient from "@/components/SettingsClient"
import { requirePageRole } from "@/lib/page-auth"

export const instant = false

export default async function SettingsPage() {
  await requirePageRole(["MANAJER"])
  const settings = await prisma.setting.findMany()

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      <header className="border-b border-zinc-800 pb-4">
        <p className="mb-1 text-xs font-medium text-amber-400">KONFIGURASI SISTEM</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Pengaturan</h1>
        <p className="mt-1 text-sm text-zinc-400">Atur identitas struk, biaya transaksi, promo, dan keamanan akun.</p>
      </header>
      <SettingsClient settings={settings} />
    </main>
  )
}

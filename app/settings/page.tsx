import { prisma } from "@/lib/prisma"
import SettingsClient from "@/components/SettingsClient"

export const instant = false

export default async function SettingsPage() {
  const settings = await prisma.setting.findMany()

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="pb-4 border-b border-zinc-800">
        <h1 className="text-3xl font-bold">Pengaturan</h1>
        <p className="text-sm text-zinc-400 mt-1">Konfigurasi pajak, service charge, dan pembulatan. Nilai final akan dikonfirmasi client.</p>
      </header>
      <SettingsClient settings={settings} />
    </main>
  )
}

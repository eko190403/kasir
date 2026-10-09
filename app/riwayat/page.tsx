import { prisma } from "@/lib/prisma"
import RiwayatClient from "@/components/RiwayatClient"
import { connection } from "next/server"
import { History, ShieldCheck, AlertTriangle, Clock3 } from "lucide-react"

export const instant = false

function parseLogDetail(detail: string) {
  try {
    const parsed = JSON.parse(detail)
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object') {
      const keys = ['alasan', 'billId', 'nomorBill', 'namaItem', 'otorisasi']
      for (const key of keys) {
        if (parsed[key]) return `${key}: ${parsed[key]}`
      }
      return JSON.stringify(parsed)
    }
    return detail
  } catch {
    return detail
  }
}

export default async function RiwayatPage() {
  await connection()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [recentAuditLogs, sensitiveAuditCount, weeklyAuditCount] = await Promise.all([
    prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { waktu: 'desc' },
      take: 12
    }),
    prisma.auditLog.count({
      where: {
        aksi: { in: ['VOID_ITEM', 'COMP_ITEM', 'CANCEL_BILL', 'KOREKSI_BATAL_BILL_LUNAS'] }
      }
    }),
    prisma.auditLog.count({
      where: { waktu: { gte: sevenDaysAgo } }
    })
  ])

  return (
    <main className="container mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <History className="w-8 h-8 text-emerald-500" />
            Riwayat Transaksi
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Cari tagihan lama, pantau audit operasional, dan review aktivitas koreksi manajer.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3 text-emerald-400">
            <Clock3 className="w-5 h-5" />
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-400">7 Hari</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-white">{weeklyAuditCount}</p>
          <p className="text-sm text-zinc-400">aktivitas audit</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-400">Koreksi</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-white">{sensitiveAuditCount}</p>
          <p className="text-sm text-zinc-400">void, comp, void bill, cancel</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3 text-blue-400">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-400">Status</span>
          </div>
          <p className="mt-3 text-xl font-bold text-white">Manager review enabled</p>
          <p className="text-sm text-zinc-400">setiap koreksi tercatat dan dapat ditelusuri</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-lg font-bold">Audit Trail Terbaru</h2>
          <div className="space-y-3">
            {recentAuditLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">Belum ada aktivitas audit.</p>
            ) : (
              recentAuditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                          {log.aksi}
                        </span>
                        <span className="text-xs text-zinc-500">{log.entitas}</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">
                        {parseLogDetail(log.detail)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      <p>{log.user?.nama || 'Sistem'}</p>
                      <p>{new Date(log.waktu).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-lg font-bold">Catatan Operasional</h2>
          <ul className="space-y-3 text-sm text-zinc-300">
            <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              Semua void, comp, dan cancel bill disimpan dalam audit trail untuk traceability.
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              Manager perlu memvalidasi alasan koreksi agar setiap perubahan memiliki alasan yang terdokumentasi.
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              Ringkasan transaksi dan cash reconciliation dapat ditelusuri dari halaman summary dan EOD report.
            </li>
          </ul>
        </div>
      </div>

      <RiwayatClient />
    </main>
  )
}

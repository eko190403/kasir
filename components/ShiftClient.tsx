"use client"

import { useState } from "react"
import { openShift, closeShift, catatPengeluaran } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Payment, Shift, User } from "@prisma/client"
import { Clock3, Plus, Wallet } from "lucide-react"

const fieldClass = "mt-1 h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"

type ShiftBill = {
  total: number
  metodeBayar: string | null
  payments: Pick<Payment, "metode" | "jumlah" | "status">[]
}
type ShiftRefund = { metode: Payment["metode"]; jumlah: number }
type ShiftWithCashier = Shift & { kasir: User | null; bills: ShiftBill[]; refunds: ShiftRefund[] }
type ShiftPaymentSummary = Record<"TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER", number> & {
  legacySplitUnallocated: number
}

function getShiftPaymentSummary(bills: ShiftBill[]) {
  const summary: ShiftPaymentSummary = {
    TUNAI: 0,
    KARTU: 0,
    QRIS: 0,
    DEBIT: 0,
    TRANSFER: 0,
    legacySplitUnallocated: 0,
  }

  for (const bill of bills) {
    if (bill.payments.length > 0) {
      for (const payment of bill.payments) {
        if (payment.status === "SUDAH_BAYAR") {
          summary[payment.metode] += payment.jumlah
        }
      }
      continue
    }

    const method = (bill.metodeBayar ?? "TUNAI").trim().toUpperCase()
    if (method === "SPLIT" || method.startsWith("SPLIT (")) {
      summary.legacySplitUnallocated += bill.total
    } else if (method === "CASH") {
      summary.TUNAI += bill.total
    } else {
      switch (method) {
        case "TUNAI":
        case "KARTU":
        case "QRIS":
        case "DEBIT":
        case "TRANSFER":
          summary[method] += bill.total
          break
        default:
          summary.legacySplitUnallocated += bill.total
      }
    }
  }

  return summary
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function ShiftClient({ shifts, users, currentRole, currentUserId }: {
  shifts: ShiftWithCashier[]
  users: Pick<User, "id" | "nama" | "peran">[]
  currentRole: "MANAJER" | "KASIR"
  currentUserId: string
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [kasirId, setKasirId] = useState('')
  const [kasAwal, setKasAwal] = useState(0)
  const [shiftPin, setShiftPin] = useState('')
  const [kasHitung, setKasHitung] = useState('')
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)

  const handleOpen = async () => {
    if (currentRole === "MANAJER" && !kasirId) { toast.warning("Pilih kasir dulu"); return }
    setLoading(true)
    try {
      const targetKasirId = currentRole === "KASIR" ? currentUserId : kasirId
      await openShift(targetKasirId, kasAwal)
      toast.success(`Shift dibuka untuk ${users.find(u => u.id === targetKasirId)?.nama || 'kasir'}!`)
      setShowForm(false)
      setKasirId('')
      setKasAwal(0)
      router.refresh()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal membuka shift."))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async (shiftId: string) => {
    setPendingCloseId(shiftId)
    setShiftPin('')
    setKasHitung('')
  }

  const confirmCloseShift = async () => {
    if (!pendingCloseId) return
    if (kasHitung.trim() === "") {
      toast.warning("Masukkan jumlah kas fisik setelah menghitung uang di laci.")
      return
    }

    const countedCash = Number(kasHitung)
    if (!Number.isSafeInteger(countedCash) || countedCash < 0) {
      toast.warning("Masukkan jumlah kas fisik berupa rupiah bulat dan tidak negatif.")
      return
    }

    setLoading(true)
    try {
      await closeShift(pendingCloseId, countedCash, shiftPin)
      toast.success('Shift berhasil ditutup!')
      setPendingCloseId(null)
      setShiftPin('')
      setKasHitung('')
      router.refresh()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal menutup shift."))
    } finally {
      setLoading(false)
    }
  }

  const activeShifts = shifts.filter(s => !s.waktuTutup)
  const closedShifts = shifts.filter(s => s.waktuTutup)

  // Petty Cash State
  const [pettyCashId, setPettyCashId] = useState<string | null>(null)
  const [pettyJumlah, setPettyJumlah] = useState(0)
  const [pettyCatatan, setPettyCatatan] = useState("")

  const handlePettyCash = async () => {
    if (!pettyCashId || pettyJumlah <= 0 || !pettyCatatan.trim()) {
      toast.warning("Isi jumlah dan catatan pengeluaran terlebih dahulu")
      return
    }

    setLoading(true)
    try {
      await catatPengeluaran(pettyCashId, pettyJumlah, pettyCatatan.trim(), shiftPin)
      toast.success('Pengeluaran berhasil dicatat.')
      setPettyCashId(null)
      setPettyJumlah(0)
      setPettyCatatan("")
      setShiftPin("")
      router.refresh()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mencatat kas keluar."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Operasional shift</h2>
          <p className="mt-1 text-sm text-zinc-500">{activeShifts.length} shift aktif · {closedShifts.length} shift ditutup</p>
        </div>
        <button onClick={() => setShowForm(current => !current)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500">
          <Plus className="h-4 w-4" /> {showForm ? "Tutup formulir" : "Buka shift"}
        </button>
      </section>

      {showForm && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="mb-4 border-b border-zinc-800 pb-3">
            <h2 className="text-base font-semibold text-zinc-100">Shift baru</h2>
            <p className="mt-1 text-sm text-zinc-500">Tentukan kasir dan jumlah kas awal di laci.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {currentRole === "MANAJER" && (
              <label className="text-xs text-zinc-400">
                Kasir
                <select value={kasirId} onChange={e => setKasirId(e.target.value)} className={fieldClass}>
                  <option value="">Pilih kasir</option>
                  {users.filter(user => user.peran === "KASIR").map(user => <option key={user.id} value={user.id}>{user.nama}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs text-zinc-400">
              Kas awal (Rp)
              <input type="number" min="0" value={kasAwal} onChange={e => setKasAwal(parseInt(e.target.value) || 0)} className={fieldClass} />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button onClick={() => setShowForm(false)} className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800">Batal</button>
            <button onClick={handleOpen} disabled={loading} className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50">{loading ? "Membuka..." : "Buka shift"}</button>
          </div>
        </section>
      )}

      {/* Active Shifts */}
      {activeShifts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-100">Shift aktif</h2>
            <span className="text-xs tabular-nums text-zinc-500">{activeShifts.length} berjalan</span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {activeShifts.map(s => (
              <article key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-zinc-100">{s.kasir?.nama}</h3>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      Dibuka {new Date(s.waktuBuka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded border border-emerald-900 bg-emerald-950/30 px-2 py-1 text-xs font-medium text-emerald-300">Aktif</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-4">
                  <div>
                    <p className="text-xs text-zinc-500">Kas awal</p>
                    <p className="mt-1 text-sm font-medium tabular-nums text-zinc-200">Rp {s.kasAwal.toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Kas keluar</p>
                    <p className="mt-1 text-sm font-medium tabular-nums text-zinc-200">Rp {s.pengeluaran.toLocaleString("id-ID")}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3 sm:flex-row">
                  <button onClick={() => { setPettyCashId(s.id); setShiftPin('') }} disabled={loading}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50">
                    <Wallet className="h-4 w-4" /> Catat kas keluar
                  </button>
                  <button onClick={() => handleClose(s.id)} disabled={loading}
                    className="h-9 flex-1 rounded-md bg-amber-600 px-3 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50">
                    Tutup shift
                  </button>
                </div>
              </article>
            ))}
          </div>

        </div>
      )}

      {pettyCashId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="petty-cash-title" className="w-full max-w-md space-y-4 rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h3 id="petty-cash-title" className="text-base font-semibold text-zinc-100">Catat kas keluar</h3>
              <p className="mt-1 text-sm text-zinc-500">Catatan ini akan masuk ke rekap shift.</p>
            </div>
            <label className="block text-xs text-zinc-400">
              Jumlah (Rp)
              <input type="number" min="0" value={pettyJumlah} onChange={e => setPettyJumlah(parseInt(e.target.value) || 0)} className={fieldClass} />
            </label>
            <label className="block text-xs text-zinc-400">
              Catatan / keperluan
              <input type="text" value={pettyCatatan} onChange={e => setPettyCatatan(e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-xs text-zinc-400">
              PIN manager (opsional untuk kasir)
              <input type="password" inputMode="numeric" value={shiftPin} onChange={e => setShiftPin(e.target.value)} className={fieldClass} />
            </label>
            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
              <button onClick={() => { setPettyCashId(null); setShiftPin("") }} className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Batal</button>
              <button onClick={handlePettyCash} disabled={loading} className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </section>
        </div>
      )}

      {pendingCloseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="close-shift-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
            <div className="border-b border-zinc-800 pb-3">
              <h3 id="close-shift-title" className="text-base font-semibold text-zinc-100">Tutup shift</h3>
              <p className="mt-1 text-sm text-zinc-500">Periksa ringkasan pembayaran dan masukkan kas fisik untuk melanjutkan.</p>
            </div>
            {(() => {
              const shift = activeShifts.find(item => item.id === pendingCloseId)
              if (!shift) return null
              const paymentSummary = getShiftPaymentSummary(shift.bills)
              const cashRefund = shift.refunds
                .filter(refund => refund.metode === "TUNAI")
                .reduce((sum, refund) => sum + refund.jumlah, 0)
              const nonCashRefund = shift.refunds
                .filter(refund => refund.metode !== "TUNAI")
                .reduce((sum, refund) => sum + refund.jumlah, 0)
              const cashExpected = shift.kasAwal + paymentSummary.TUNAI - cashRefund - shift.pengeluaran
              const nonCashMethods = ["KARTU", "QRIS", "DEBIT", "TRANSFER"] as const
              const nonCashTotal = nonCashMethods.reduce((sum, method) => sum + paymentSummary[method], 0)

              return (
                <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm">
                  <div className="flex justify-between gap-3 font-semibold text-zinc-100">
                    <span>Perkiraan kas tunai</span>
                    <span className="shrink-0 tabular-nums">Rp {cashExpected.toLocaleString("id-ID")}</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Kas awal + penjualan tunai − refund tunai − kas keluar. Hitung hanya uang fisik di laci.
                  </p>
                  {cashRefund > 0 && (
                    <div className="flex justify-between text-xs text-red-400">
                      <span>Refund tunai (kas keluar)</span>
                      <span>− Rp {cashRefund.toLocaleString("id-ID")}</span>
                    </div>
                  )}
                  {nonCashRefund > 0 && (
                    <div className="flex justify-between text-xs text-amber-400">
                      <span>Refund non-tunai (tidak mengurangi laci)</span>
                      <span>Rp {nonCashRefund.toLocaleString("id-ID")}</span>
                    </div>
                  )}
                  <div className="border-t border-zinc-800 pt-2">
                    <div className="mb-1 text-xs font-bold text-zinc-300">Non-tunai tercatat (tidak masuk laci)</div>
                    {nonCashMethods.map(method => (
                      <div key={method} className="flex justify-between text-xs text-zinc-400">
                        <span>{method}</span>
                        <span>Rp {paymentSummary[method].toLocaleString("id-ID")}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between text-xs font-semibold text-zinc-300">
                      <span>Total non-tunai</span>
                      <span>Rp {nonCashTotal.toLocaleString("id-ID")}</span>
                    </div>
                    {paymentSummary.legacySplitUnallocated > 0 && (
                      <p className="mt-2 text-xs text-amber-400">
                        Ada pembayaran lama campuran Rp {paymentSummary.legacySplitUnallocated.toLocaleString("id-ID")} tanpa rincian metode; cek struk/laporan sebelum rekonsiliasi.
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}
            <label className="block text-xs text-zinc-400">
              PIN manager
              <input type="password" inputMode="numeric" value={shiftPin} onChange={e => setShiftPin(e.target.value)}
                className={fieldClass} />
            </label>
            <label className="block text-xs text-zinc-400">
              Kas fisik dihitung (Rp)
              <input type="number" min="0" step="1" value={kasHitung}
                onChange={e => setKasHitung(e.target.value)}
                className={fieldClass} />
              <p className="mt-1 text-xs text-zinc-500">Masukkan hanya uang fisik di laci. Jangan tambahkan QRIS, debit, transfer, atau kartu.</p>
            </label>
            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
              <button onClick={() => { setPendingCloseId(null); setShiftPin("") }} className="h-10 rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Batal</button>
              <button onClick={confirmCloseShift} disabled={loading} className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">{loading ? "Memproses..." : "Konfirmasi tutup shift"}</button>
            </div>
          </section>
        </div>
      )}

      {/* Closed Shifts */}
      {closedShifts.length > 0 && (
        <div>
          <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
              <h2 className="text-base font-semibold text-zinc-100">Riwayat shift</h2>
              <p className="mt-1 text-sm text-zinc-500">{closedShifts.length} shift selesai</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-950 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Kasir</th>
                  <th className="px-4 py-3 text-left font-medium">Waktu</th>
                  <th className="px-4 py-3 text-right font-medium">Kas awal</th>
                  <th className="px-4 py-3 text-right font-medium">Penjualan</th>
                  <th className="px-4 py-3 text-right font-medium">Kas keluar</th>
                  <th className="px-4 py-3 text-right font-medium">Kas akhir</th>
                  <th className="px-4 py-3 text-right font-medium">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {closedShifts.map(s => (
                  <tr key={s.id} className="transition-colors hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium text-zinc-200">{s.kasir?.nama}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-zinc-400">
                      {new Date(s.waktuBuka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} – {s.waktuTutup ? new Date(s.waktuTutup).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">Rp {s.kasAwal.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">Rp {(s.totalPenjualan || 0).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300" title={s.catatanPengeluaran ?? undefined}>Rp {s.pengeluaran.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-100">
                      {s.kasHitung == null ? <span className="text-zinc-500">Belum dihitung</span> : `Rp ${s.kasHitung.toLocaleString("id-ID")}`}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${s.selisih == null ? "text-zinc-500" : s.selisih === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      {s.selisih == null ? "Belum dihitung" : `${s.selisih > 0 ? "+" : ""}Rp ${s.selisih.toLocaleString("id-ID")}`}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

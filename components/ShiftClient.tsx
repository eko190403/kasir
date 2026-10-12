"use client"

import { useState } from "react"
import { openShift, closeShift, catatPengeluaran } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Payment, Shift, User } from "@prisma/client"

type ShiftBill = {
  total: number
  metodeBayar: string | null
  payments: Pick<Payment, "metode" | "jumlah" | "status">[]
}
type ShiftWithCashier = Shift & { kasir: User | null; bills: ShiftBill[] }
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
    <div className="space-y-6">
      {/* Open Shift Form */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition">
          + Buka Shift Baru
        </button>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4 max-w-md">
          <h2 className="font-bold text-lg">Buka Shift</h2>
          {currentRole === "MANAJER" && <div>
            <label className="text-xs text-zinc-400">Kasir</label>
            <select value={kasirId} onChange={e => setKasirId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500">
              <option value="">Pilih Kasir</option>
              {users.filter(u => u.peran === 'KASIR').map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
          </div>}
          <div>
            <label className="text-xs text-zinc-400">Kas Awal (Rp)</label>
            <input type="number" min="0" value={kasAwal} onChange={e => setKasAwal(parseInt(e.target.value) || 0)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
            <button onClick={handleOpen} disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 rounded-lg text-sm font-bold">Buka Shift</button>
          </div>
        </div>
      )}

      {/* Active Shifts */}
      {activeShifts.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-3 text-emerald-400">Shift Aktif</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeShifts.map(s => (
              <div key={s.id} className="bg-zinc-900 border border-emerald-800 p-5 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{s.kasir?.nama}</h3>
                    <p className="text-xs text-zinc-400">Buka: {new Date(s.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-bold rounded-md bg-emerald-600">AKTIF</span>
                </div>
                <div className="text-sm text-zinc-300 space-y-1">
                  <div>Kas Awal: <span className="font-bold">Rp {s.kasAwal.toLocaleString('id-ID')}</span></div>
                  <div className="text-red-400">Kas Keluar: <span>Rp {s.pengeluaran.toLocaleString('id-ID')}</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPettyCashId(s.id); setShiftPin('') }} disabled={loading}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 rounded-lg text-xs font-bold transition">
                    + Kas Keluar
                  </button>
                  <button onClick={() => handleClose(s.id)} disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg text-xs font-bold transition">
                    Tutup Shift
                  </button>
                </div>
              </div>
            ))}
          </div>

          {pettyCashId && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-zinc-900 border border-zinc-700 p-5 rounded-xl space-y-4 w-full max-w-sm">
                <h3 className="font-bold">Catat Kas Keluar (Petty Cash)</h3>
                <div>
                  <label className="text-xs text-zinc-400">Jumlah (Rp)</label>
                  <input type="number" min="0" value={pettyJumlah} onChange={e => setPettyJumlah(parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Catatan / Keperluan</label>
                  <input type="text" value={pettyCatatan} onChange={e => setPettyCatatan(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">PIN Manager (opsional untuk kasir)</label>
                  <input type="password" inputMode="numeric" value={shiftPin} onChange={e => setShiftPin(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setPettyCashId(null); setShiftPin('') }} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
                  <button onClick={handlePettyCash} disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 rounded-lg text-sm font-bold">Simpan</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {pendingCloseId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 p-5 rounded-xl space-y-4 w-full max-w-sm">
            <h3 className="font-bold text-lg">Konfirmasi Tutup Shift</h3>
            <p className="text-sm text-zinc-300">Tutup shift memerlukan otorisasi manager. Masukkan PIN manager untuk melanjutkan.</p>
            {(() => {
              const shift = activeShifts.find(item => item.id === pendingCloseId)
              if (!shift) return null
              const paymentSummary = getShiftPaymentSummary(shift.bills)
              const cashExpected = shift.kasAwal + paymentSummary.TUNAI - shift.pengeluaran
              const nonCashMethods = ["KARTU", "QRIS", "DEBIT", "TRANSFER"] as const
              const nonCashTotal = nonCashMethods.reduce((sum, method) => sum + paymentSummary[method], 0)

              return (
                <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm">
                  <div className="flex justify-between font-semibold">
                    <span>Kas tunai seharusnya</span>
                    <span>Rp {cashExpected.toLocaleString("id-ID")}</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Kas awal + penjualan tunai − kas keluar. Hitung dan masukkan hanya uang fisik di laci.
                  </p>
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
            <div>
              <label className="text-xs text-zinc-400">PIN Manager</label>
              <input type="password" inputMode="numeric" value={shiftPin} onChange={e => setShiftPin(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Kas fisik dihitung (Rp)</label>
              <input type="number" min="0" step="1" value={kasHitung}
                onChange={e => setKasHitung(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:border-emerald-500" />
              <p className="mt-1 text-xs text-zinc-500">Masukkan hanya uang fisik di laci. Jangan tambahkan QRIS, debit, transfer, atau kartu.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setPendingCloseId(null); setShiftPin('') }} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
              <button onClick={confirmCloseShift} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg text-sm font-bold">Konfirmasi</button>
            </div>
          </div>
        </div>
      )}

      {/* Closed Shifts */}
      {closedShifts.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-3 text-zinc-400">Riwayat Shift</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-400 text-xs">
                <tr>
                  <th className="text-left py-2">Kasir</th>
                  <th className="text-left py-2">Waktu</th>
                  <th className="text-right py-2">Kas Awal</th>
                  <th className="text-right py-2">Penjualan</th>
                  <th className="text-right py-2">Kas Keluar</th>
                  <th className="text-right py-2">Kas Akhir</th>
                  <th className="text-right py-2">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {closedShifts.map(s => (
                  <tr key={s.id} className="hover:bg-zinc-800/50">
                    <td className="py-2">{s.kasir?.nama}</td>
                    <td className="py-2 text-xs">
                      {new Date(s.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {s.waktuTutup ? new Date(s.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </td>
                    <td className="py-2 text-right">Rp {s.kasAwal.toLocaleString('id-ID')}</td>
                    <td className="py-2 text-right text-emerald-400">Rp {(s.totalPenjualan || 0).toLocaleString('id-ID')}</td>
                    <td className="py-2 text-right text-red-400" title={s.catatanPengeluaran ?? undefined}>Rp {s.pengeluaran.toLocaleString('id-ID')}</td>
                    <td className="py-2 text-right font-bold">
                      {s.kasHitung == null ? 'Belum dihitung' : `Rp ${s.kasHitung.toLocaleString('id-ID')}`}
                    </td>
                    <td className={`py-2 text-right font-bold ${s.selisih == null ? 'text-zinc-500' : s.selisih === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {s.selisih == null ? 'Belum dihitung' : `${s.selisih > 0 ? '+' : ''}Rp ${s.selisih.toLocaleString('id-ID')}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

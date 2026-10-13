"use client"

import { useState } from "react"
import { updateSetting, verifyAndUpdatePin } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const fieldClass = "h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
const saveButtonClass = "h-10 shrink-0 rounded-md bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
const cardClass = "space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function SettingsClient({ settings }: { settings: { kunci: string, nilai: string }[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const getVal = (key: string) => settings.find(s => s.kunci === key)?.nilai || ''
  const [pajak, setPajak] = useState(getVal('PAJAK'))
  const [serviceCharge, setServiceCharge] = useState(getVal('SERVICE_CHARGE'))
  const [pembulatan, setPembulatan] = useState(getVal('PEMBULATAN_RATUSAN'))
  const [namaBar, setNamaBar] = useState(getVal('NAMA_BAR') || 'Superbar')
  const [alamatBar, setAlamatBar] = useState(getVal('ALAMAT_BAR') || 'Jl. Gatot Subroto Barat No.317 Pemecutan Kaja, North Denpasar')
  const [pinLama, setPinLama] = useState('')
  const [pinBaru, setPinBaru] = useState('')
  const [pinKonfirmasi, setPinKonfirmasi] = useState('')
  const [pinError, setPinError] = useState('')
  
  const [hhAktif, setHhAktif] = useState(getVal('HAPPY_HOUR_AKTIF') || 'false')
  const [hhMulai, setHhMulai] = useState(getVal('HAPPY_HOUR_MULAI') || '17:00')
  const [hhSelesai, setHhSelesai] = useState(getVal('HAPPY_HOUR_SELESAI') || '20:00')
  const [hhDiskon, setHhDiskon] = useState(getVal('HAPPY_HOUR_DISKON') || '10')

  const handleSave = async (kunci: string, nilai: string) => {
    setLoading(true)
    try {
      await updateSetting(kunci, nilai)
      toast.success('Pengaturan berhasil disimpan!')
      router.refresh()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal menyimpan pengaturan."))
    } finally {
      setLoading(false)
    }
  }

  const handleGantiPin = async () => {
    setPinError('')
    if (!/^\d{4,6}$/.test(pinBaru)) { setPinError('PIN baru harus 4–6 digit'); return }
    if (pinBaru !== pinKonfirmasi) { setPinError('PIN baru dan konfirmasi tidak cocok'); return }
    if (!pinLama) { setPinError('PIN lama harus diisi'); return }
    setLoading(true)
    try {
      // Validasi PIN lama via server action
      const result = await verifyAndUpdatePin(pinLama, pinBaru)
      if (result?.error) { setPinError(result.error); return }
      setPinLama(''); setPinBaru(''); setPinKonfirmasi('')
      toast.success('PIN Manajer berhasil diubah!')
      router.refresh()
    } catch (err: unknown) {
      setPinError(getErrorMessage(err, "Gagal mengubah PIN."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
      <section className={cardClass}>
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-semibold text-zinc-100">Identitas usaha</h2>
          <p className="mt-1 text-sm text-zinc-500">Informasi yang akan dicetak pada struk transaksi.</p>
        </div>
        <label className="block text-xs text-zinc-400">
          Nama bar
          <div className="mt-1 flex gap-2">
            <input type="text" value={namaBar} onChange={e => setNamaBar(e.target.value)} className={fieldClass} />
            <button onClick={() => handleSave('NAMA_BAR', namaBar)} disabled={loading} className={saveButtonClass}>Simpan</button>
          </div>
        </label>
        <label className="block text-xs text-zinc-400">
          Alamat / kontak
          <div className="mt-1 flex gap-2">
            <input type="text" value={alamatBar} onChange={e => setAlamatBar(e.target.value)} placeholder="Alamat atau nomor telepon" className={fieldClass} />
            <button onClick={() => handleSave('ALAMAT_BAR', alamatBar)} disabled={loading} className={saveButtonClass}>Simpan</button>
          </div>
        </label>
      </section>

      <section className={cardClass}>
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-semibold text-zinc-100">Pajak dan layanan</h2>
          <p className="mt-1 text-sm text-zinc-500">Persentase yang diterapkan pada bill.</p>
        </div>
        <label className="block text-xs text-zinc-400">
          Pajak (%)
          <div className="mt-1 flex gap-2">
            <input type="number" min="0" max="100" step="any" value={pajak} onChange={e => setPajak(e.target.value)} className={fieldClass} />
            <button onClick={() => handleSave('PAJAK', pajak)} disabled={loading} className={saveButtonClass}>Simpan</button>
          </div>
        </label>
        <label className="block text-xs text-zinc-400">
          Service charge (%)
          <div className="mt-1 flex gap-2">
            <input type="number" min="0" max="100" step="any" value={serviceCharge} onChange={e => setServiceCharge(e.target.value)} className={fieldClass} />
            <button onClick={() => handleSave('SERVICE_CHARGE', serviceCharge)} disabled={loading} className={saveButtonClass}>Simpan</button>
          </div>
        </label>
      </section>

      <section className={cardClass}>
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-semibold text-zinc-100">Pembulatan transaksi</h2>
          <p className="mt-1 text-sm text-zinc-500">Jika aktif, total akhir dibulatkan ke ratusan terdekat.</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Pembulatan ke ratusan</p>
            <p className="mt-1 text-xs text-zinc-500">Status saat ini: {pembulatan === 'true' ? 'Aktif' : 'Nonaktif'}</p>
          </div>
          <button
            onClick={() => { const val = pembulatan === 'true' ? 'false' : 'true'; setPembulatan(val); handleSave('PEMBULATAN_RATUSAN', val) }}
            disabled={loading}
            aria-pressed={pembulatan === 'true'}
            className={`h-10 min-w-24 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${pembulatan === 'true' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {pembulatan === 'true' ? 'Aktif' : 'Nonaktif'}
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-semibold text-zinc-100">Happy hour</h2>
          <p className="mt-1 text-sm text-zinc-500">Diskon otomatis untuk item yang dipesan pada rentang waktu promo.</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Promo waktu tertentu</p>
            <p className="mt-1 text-xs text-zinc-500">Status saat ini: {hhAktif === 'true' ? 'Aktif' : 'Nonaktif'}</p>
          </div>
          <button
            onClick={() => { const val = hhAktif === 'true' ? 'false' : 'true'; setHhAktif(val); handleSave('HAPPY_HOUR_AKTIF', val) }}
            disabled={loading}
            aria-pressed={hhAktif === 'true'}
            className={`h-10 min-w-24 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${hhAktif === 'true' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {hhAktif === 'true' ? 'Aktif' : 'Nonaktif'}
          </button>
        </div>
        {hhAktif === 'true' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs text-zinc-400">
              Jam mulai
              <input type="time" value={hhMulai} onChange={e => setHhMulai(e.target.value)} onBlur={() => handleSave('HAPPY_HOUR_MULAI', hhMulai)} className={`${fieldClass} mt-1`} />
            </label>
            <label className="text-xs text-zinc-400">
              Jam selesai
              <input type="time" value={hhSelesai} onChange={e => setHhSelesai(e.target.value)} onBlur={() => handleSave('HAPPY_HOUR_SELESAI', hhSelesai)} className={`${fieldClass} mt-1`} />
            </label>
            <label className="text-xs text-zinc-400">
              Diskon item (%)
              <input type="number" min="1" max="100" value={hhDiskon} onChange={e => setHhDiskon(e.target.value)} onBlur={() => handleSave('HAPPY_HOUR_DISKON', hhDiskon)} className={`${fieldClass} mt-1`} />
            </label>
          </div>
        )}
      </section>

      <section className={`${cardClass} lg:col-span-2`}>
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-semibold text-zinc-100">Keamanan akun manajer</h2>
          <p className="mt-1 text-sm text-zinc-500">PIN dipakai untuk otorisasi tindakan sensitif. Gunakan 4–6 digit dan jangan membagikannya.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-400">
            PIN lama
            <input type="password" autoComplete="current-password" value={pinLama} onChange={e => setPinLama(e.target.value)} className={`${fieldClass} mt-1`} />
          </label>
          <label className="text-xs text-zinc-400">
            PIN baru
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pinBaru} onChange={e => setPinBaru(e.target.value)} className={`${fieldClass} mt-1`} />
          </label>
          <label className="text-xs text-zinc-400">
            Konfirmasi PIN baru
            <input type="password" autoComplete="new-password" value={pinKonfirmasi} onChange={e => setPinKonfirmasi(e.target.value)} className={`${fieldClass} mt-1`} />
          </label>
        </div>
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="text-sm text-red-400">{pinError}</p>
          <button onClick={handleGantiPin} disabled={loading} className={saveButtonClass}>
            {loading ? "Memproses..." : "Ganti PIN"}
          </button>
        </div>
      </section>
    </div>
  )
}

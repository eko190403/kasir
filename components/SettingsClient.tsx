"use client"

import { useState } from "react"
import { updateSetting, verifyAndUpdatePin } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function SettingsClient({ settings }: { settings: { kunci: string, nilai: string }[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const getVal = (key: string) => settings.find(s => s.kunci === key)?.nilai || ''
  const [pajak, setPajak] = useState(getVal('PAJAK'))
  const [serviceCharge, setServiceCharge] = useState(getVal('SERVICE_CHARGE'))
  const [pembulatan, setPembulatan] = useState(getVal('PEMBULATAN_RATUSAN'))
  const [namaBar, setNamaBar] = useState(getVal('NAMA_BAR') || 'Bar POS')
  const [alamatBar, setAlamatBar] = useState(getVal('ALAMAT_BAR') || '')
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
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGantiPin = async () => {
    setPinError('')
    if (!pinBaru || pinBaru.length < 4) { setPinError('PIN baru minimal 4 digit'); return }
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
    } catch (err: any) {
      setPinError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Identitas Bar */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
        <h3 className="font-bold">Identitas Bar (untuk Struk)</h3>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Nama Bar</label>
          <div className="flex gap-2">
            <input type="text" value={namaBar} onChange={e => setNamaBar(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
            <button onClick={() => handleSave('NAMA_BAR', namaBar)} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold">Simpan</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Alamat / Kontak</label>
          <div className="flex gap-2">
            <input type="text" value={alamatBar} onChange={e => setAlamatBar(e.target.value)}
              placeholder="Jl. Sudirman No. 1 | Telp: 0812..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
            <button onClick={() => handleSave('ALAMAT_BAR', alamatBar)} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold">Simpan</button>
          </div>
        </div>
      </div>

      {/* Pajak */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
        <h3 className="font-bold">Pajak (%)</h3>
        <p className="text-xs text-zinc-400">Persentase pajak yang diterapkan pada setiap bill.</p>
        <div className="flex gap-2">
          <input type="number" min="0" max="100" value={pajak} onChange={e => setPajak(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
          <button onClick={() => handleSave('PAJAK', pajak)} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold">Simpan</button>
        </div>
      </div>

      {/* Service Charge */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
        <h3 className="font-bold">Service Charge (%)</h3>
        <p className="text-xs text-zinc-400">Persentase biaya layanan.</p>
        <div className="flex gap-2">
          <input type="number" min="0" max="100" value={serviceCharge} onChange={e => setServiceCharge(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" />
          <button onClick={() => handleSave('SERVICE_CHARGE', serviceCharge)} disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold">Simpan</button>
        </div>
      </div>

      {/* Pembulatan */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
        <h3 className="font-bold">Pembulatan ke Ratusan</h3>
        <p className="text-xs text-zinc-400">Jika diaktifkan, total akhir akan dibulatkan ke ratusan terdekat.</p>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { const val = pembulatan === 'true' ? 'false' : 'true'; setPembulatan(val); handleSave('PEMBULATAN_RATUSAN', val) }}
            disabled={loading}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition ${pembulatan === 'true' ? 'bg-emerald-600' : 'bg-zinc-700'}`}
          >
            {pembulatan === 'true' ? 'AKTIF' : 'NONAKTIF'}
          </button>
        </div>
      </div>

      {/* Happy Hour */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-3">
        <h3 className="font-bold flex items-center gap-2">⏱️ Happy Hour / Promo Jam Tertentu</h3>
        <p className="text-xs text-zinc-400">Jika aktif, setiap item yang dipesan di jam ini otomatis mendapat diskon.</p>
        <div className="flex items-center gap-4 mb-3">
          <button 
            onClick={() => { const val = hhAktif === 'true' ? 'false' : 'true'; setHhAktif(val); handleSave('HAPPY_HOUR_AKTIF', val) }}
            disabled={loading}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition ${hhAktif === 'true' ? 'bg-emerald-600' : 'bg-zinc-700'}`}
          >
            {hhAktif === 'true' ? 'AKTIF' : 'NONAKTIF'}
          </button>
        </div>
        {hhAktif === 'true' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Jam Mulai</label>
              <input type="time" value={hhMulai} onChange={e => setHhMulai(e.target.value)} onBlur={() => handleSave('HAPPY_HOUR_MULAI', hhMulai)} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Jam Selesai</label>
              <input type="time" value={hhSelesai} onChange={e => setHhSelesai(e.target.value)} onBlur={() => handleSave('HAPPY_HOUR_SELESAI', hhSelesai)} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Diskon Item (%)</label>
              <input type="number" min="1" max="100" value={hhDiskon} onChange={e => setHhDiskon(e.target.value)} onBlur={() => handleSave('HAPPY_HOUR_DISKON', hhDiskon)} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}
      </div>

      {/* Ganti PIN Manajer */}
      <div className="bg-zinc-900 border border-amber-800/40 p-5 rounded-xl space-y-3">
        <h3 className="font-bold text-amber-400">🔐 Ganti PIN Manajer</h3>
        <p className="text-xs text-zinc-400">PIN ini digunakan untuk otorisasi Void dan Comp. Default awal: <code className="bg-zinc-800 px-1 rounded">123456</code></p>
        <div className="space-y-2">
          <input type="password" placeholder="PIN Lama" value={pinLama} onChange={e => setPinLama(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-amber-500" />
          <input type="password" placeholder="PIN Baru (min 4 digit)" value={pinBaru} onChange={e => setPinBaru(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-amber-500" />
          <input type="password" placeholder="Konfirmasi PIN Baru" value={pinKonfirmasi} onChange={e => setPinKonfirmasi(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-amber-500" />
          {pinError && <p className="text-red-400 text-xs">{pinError}</p>}
          <button onClick={handleGantiPin} disabled={loading} className="w-full py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold transition">
            Ganti PIN
          </button>
        </div>
      </div>
    </div>
  )
}

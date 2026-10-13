"use client"

import { useState, useEffect, useCallback } from "react"
import { addMenuItemToBill, closeBill, returnItem, applyDiscount, voidItem, compItem, updateItemQty, cancelBill, applyReservationDeposit, confirmPayment } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getHappyHourOriginalPrice, isHappyHourMenuName } from "@/lib/menu-catalog"
import { isTimeWithinRange } from "@/lib/timezone"

export default function BillClient({ 
  billId, 
  canOperatePayments,
  menuItems,
  initialBillItems,
  initialPayments,
  depositReservasis,
  totals
}: { 
  billId: string,  
  canOperatePayments: boolean,
  menuItems: any[],
  initialBillItems: any[],
  initialPayments: any[],
  depositReservasis: any[],
  totals: any
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [billItems, setBillItems] = useState(initialBillItems)
  const [currentTotals, setCurrentTotals] = useState(totals)
  const [catatan, setCatatan] = useState("")
  const [menuFilter, setMenuFilter] = useState<"SEMUA" | "MAKANAN" | "MINUMAN">("SEMUA")
  
  // Payment State
  const [showPayment, setShowPayment] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelPin, setCancelPin] = useState("")
  const [cancelAlasan, setCancelAlasan] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER" | "SPLIT">("TUNAI")
  const [splitCash, setSplitCash] = useState("")
  const [splitCard, setSplitCard] = useState("")
  const [splitQris, setSplitQris] = useState("")
  const [splitDebit, setSplitDebit] = useState("")
  const [splitTransfer, setSplitTransfer] = useState("")
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({})
  const [uangDiterimaInput, setUangDiterimaInput] = useState<{ amount: string; due: number } | null>(null)
  const [legacyDepositMetode, setLegacyDepositMetode] = useState<"TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER">("TUNAI")
  const totalSudahDibayar = initialPayments
    .filter(payment => payment.status !== 'PENDING' && payment.status !== 'GAGAL' && payment.status !== 'BATAL')
    .reduce((sum, payment) => sum + payment.jumlah, 0)
  const jumlahPending = initialPayments.filter(payment => payment.status === 'PENDING').length
  const sudahLunas = totalSudahDibayar >= totals.total
  const sisaPembayaran = Math.max(0, totals.total - totalSudahDibayar)
  const uangDiterima = uangDiterimaInput?.due === sisaPembayaran
    ? uangDiterimaInput.amount
    : sisaPembayaran.toString()

  // Discount State
  const [showDiscount, setShowDiscount] = useState(false)
  const [diskonInput, setDiskonInput] = useState(totals.diskon.toString())
  const [diskonAlasan, setDiskonAlasan] = useState("")
  const [diskonPin, setDiskonPin] = useState("")

  // Action State (Return, Void, Comp)
  const [actionItemId, setActionItemId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<"RETUR" | "VOID" | "COMP">("RETUR")
  const [actionAlasan, setActionAlasan] = useState("")
  const [actionPin, setActionPin] = useState("")

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Allow Escape to close modals even from inside inputs
        if (e.key === 'Escape') {
          setShowPayment(false)
          setShowCancel(false)
          setShowDiscount(false)
          setActionItemId(null)
        }
        return
      }

      switch (e.key) {
        case 'F2':
          e.preventDefault()
          setShowPayment(v => !v)
          setShowCancel(false)
          break
        case 'F4':
          e.preventDefault()
          setShowDiscount(v => !v)
          break
        case 'Escape':
          e.preventDefault()
          setShowPayment(false)
          setShowCancel(false)
          setShowDiscount(false)
          setActionItemId(null)
          break
        case 'm':
        case 'M':
          setMenuFilter(f => f === 'MAKANAN' ? 'SEMUA' : 'MAKANAN')
          break
        case 'b':
        case 'B':
          setMenuFilter(f => f === 'MINUMAN' ? 'SEMUA' : 'MINUMAN')
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const approvalNotice = actionType === 'VOID' || actionType === 'COMP'
    ? 'Persetujuan Manager: alasan koreksi wajib diisi dan PIN manajer akan diverifikasi untuk mencatat perubahan ke audit trail.'
    : actionType === 'RETUR'
      ? 'Retur memerlukan alasan jelas dan PIN manajer yang valid agar perubahan dapat ditelusuri di riwayat operasional.'
      : 'Persetujuan Manager: alasan pembatalan wajib diisi dan PIN akan diverifikasi.'

  const handleAddItem = async (menuId: string) => {
    setLoading(true)
    try {
      const result = await addMenuItemToBill(billId, menuId, 1, catatan)
      setBillItems(items => [...items, result.item])
      setCurrentTotals(result.totals)
      setCatatan("")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    if (!canOperatePayments) {
      toast.error("Hanya kasir atau manajer yang dapat mencatat pembayaran.")
      return
    }
    if (jumlahPending > 0) {
      toast.info('Konfirmasi pembayaran yang masih pending sebelum membuat pembayaran baru atau menutup bill.')
      return
    }

    const totalTagihan = sisaPembayaran
    const paymentEntries = paymentMethod === "SPLIT"
      ? [
        { metode: "TUNAI" as const, jumlah: Number(splitCash) || 0 },
        { metode: "KARTU" as const, jumlah: Number(splitCard) || 0 },
        { metode: "QRIS" as const, jumlah: Number(splitQris) || 0 },
        { metode: "DEBIT" as const, jumlah: Number(splitDebit) || 0 },
        { metode: "TRANSFER" as const, jumlah: Number(splitTransfer) || 0 },
      ].filter(payment => payment.jumlah > 0)
      : totalTagihan > 0
        ? [{
            metode: paymentMethod,
            jumlah: totalTagihan
          }]
        : []

    const totalAlokasi = paymentEntries.reduce((sum, payment) => sum + payment.jumlah, 0)
    if (totalAlokasi !== totalTagihan) {
      toast.error("Alokasi pembayaran harus sama dengan sisa tagihan.")
      return
    }
    const alokasiTunai = paymentEntries
      .filter(payment => payment.metode === "TUNAI")
      .reduce((sum, payment) => sum + payment.jumlah, 0)
    const terima = alokasiTunai > 0 ? (Number(uangDiterima) || 0) : undefined

    if (alokasiTunai > 0 && (terima ?? 0) < alokasiTunai) {
      toast.error('Uang tunai yang diterima kurang dari alokasi tunai.')
      return
    }

    const requiresManualConfirmation = paymentEntries.some(payment =>
      payment.metode === "QRIS" || payment.metode === "DEBIT" || payment.metode === "TRANSFER"
    )
    const confirmationPrompt = requiresManualConfirmation
      ? `Pembayaran non-tunai akan dicatat menunggu konfirmasi. Setelah bukti transfer/QRIS masuk, konfirmasi di daftar pembayaran sebelum menutup bill.`
      : totalTagihan === 0
        ? 'Pembayaran sudah mencukupi. Tutup bill dan cetak struk?'
        : `Yakin menyelesaikan pembayaran sisa sebesar Rp ${totalTagihan.toLocaleString('id-ID')}?`

    if (!confirm(confirmationPrompt)) return

    setLoading(true)
    try {
      const result = await closeBill(billId, paymentMethod, terima, paymentEntries)
      if (result?.status === 'PENDING_CONFIRMATION') {
        toast.info('Pembayaran non-tunai tersimpan menunggu konfirmasi kasir.')
        router.refresh()
        return
      }
      window.open(`/print/receipt/${billId}`, '_blank')
      router.push('/')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmPendingPayment = async (paymentId: string) => {
    if (!canOperatePayments) {
      toast.error("Hanya kasir atau manajer yang dapat mengonfirmasi pembayaran.")
      return
    }
    const reference = paymentReferences[paymentId] ?? ""
    setLoading(true)
    try {
      const result = await confirmPayment(paymentId, reference)
      if (result.closed) {
        toast.success('Pembayaran lunas. Bill ditutup dan meja dikosongkan.')
        window.open(`/print/receipt/${billId}`, '_blank')
        router.push('/')
        return
      }

      toast.success('Pembayaran berhasil dikonfirmasi. Masih ada sisa tagihan.')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyReservationDeposit = async (reservasiId: string) => {
    const reservation = depositReservasis.find(item => item.id === reservasiId)
    if (!reservation) return
    setLoading(true)
    try {
      await applyReservationDeposit(
        billId,
        reservasiId,
        reservation.depositMetode ?? legacyDepositMetode
      )
      toast.success("Deposit reservasi diterapkan ke bill.")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelBill = async () => {
    if (!cancelAlasan.trim() || !cancelPin.trim()) {
      toast.warning("Alasan dan PIN Manajer wajib diisi")
      return
    }
    if(!confirm(`Yakin membatalkan seluruh Bill ini? Tindakan ini tidak bisa dibatalkan.`)) return
    
    setLoading(true)
    try {
      await cancelBill(billId, cancelAlasan, cancelPin)
      // will redirect to /
    } catch(err: any) {
      toast.error(err.message)
      setLoading(false)
    }
  }

  const handleItemAction = async () => {
    if(!actionItemId || !actionAlasan.trim()) {
      toast.warning("Mohon masukkan alasan")
      return
    }
    if (actionType === "RETUR" && !actionPin) {
      toast.warning("PIN Manajer wajib diisi untuk Retur")
      return
    }
    if ((actionType === "VOID" || actionType === "COMP") && !actionPin) {
      toast.warning("PIN Manajer wajib diisi untuk Void/Comp")
      return
    }
    setLoading(true)
    try {
      if (actionType === "RETUR") { await returnItem(actionItemId, actionAlasan, actionPin); toast.success('Item berhasil diretur.') }
      if (actionType === "VOID") { await voidItem(actionItemId, actionAlasan, actionPin); toast.warning('Item berhasil di-void.') }
      if (actionType === "COMP") { await compItem(actionItemId, actionAlasan, actionPin); toast.info('Item berhasil di-comp (gratis).') }
      setActionItemId(null)
      setActionAlasan("")
      setActionPin("")
      router.refresh()
    } catch(err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDiscount = async () => {
    if (!diskonAlasan.trim() || !diskonPin.trim()) {
      toast.warning("Alasan dan PIN Manajer wajib diisi untuk mengubah diskon.")
      return
    }
    setLoading(true)
    try {
      await applyDiscount(billId, parseInt(diskonInput) || 0, diskonAlasan, diskonPin)
      toast.success('Diskon berhasil diterapkan.')
      setShowDiscount(false)
      setDiskonAlasan("")
      setDiskonPin("")
      router.refresh()
    } catch(err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredMenu = menuFilter === "SEMUA" 
    ? menuItems 
    : menuItems.filter(i => i.kategori === menuFilter)
  const jakartaTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date())

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Menu Selection */}
      <div className="md:col-span-2 space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <input 
            type="text" 
            placeholder="Tambah catatan khusus (tanpa es, pedas, dll)..." 
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 mb-4"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />

          {/* Menu Filter Tabs */}
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold mr-auto">Daftar Menu</h2>
            {(["SEMUA", "MAKANAN", "MINUMAN"] as const).map(f => (
              <button 
                key={f}
                onClick={() => setMenuFilter(f)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition ${menuFilter === f ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMenu.map(item => (
              (() => {
                const isHappyHourItem = isHappyHourMenuName(item.nama)
                const happyHourAvailable = isHappyHourItem && isTimeWithinRange(jakartaTime, "21:00", "23:00")
                const originalPrice = isHappyHourItem ? getHappyHourOriginalPrice(item.nama) : null
                return (
                  <button 
                    key={item.id}
                    onClick={() => handleAddItem(item.id)}
                    disabled={!item.tersedia || loading || (isHappyHourItem && !happyHourAvailable)}
                    className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 p-4 rounded-xl text-left transition relative"
                  >
                    <div className="font-semibold">{item.nama}</div>
                    <div className="text-emerald-400 mt-1 font-medium text-sm">Rp {item.harga.toLocaleString('id-ID')}</div>
                    {originalPrice !== null && (
                      <div className="text-xs text-zinc-400 line-through">Rp {originalPrice.toLocaleString('id-ID')}</div>
                    )}
                    {isHappyHourItem && !happyHourAvailable && <div className="mt-1 text-xs text-amber-300">Tersedia 21.00–23.00 WIB</div>}
                    <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${item.tersedia ? 'bg-emerald-400' : 'bg-red-500'}`} />
                    {!item.tersedia && <div className="text-red-400 text-xs mt-1 font-bold">HABIS</div>}
                  </button>
                )
              })()
            ))}
          </div>
        </div>
      </div>

      {/* Bill Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col h-fit sticky top-20">
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/50 rounded-t-xl font-bold text-lg">
          Current Bill
        </div>
        
        <div className="p-4 flex-1 max-h-[50vh] overflow-y-auto space-y-3">
          {billItems.length === 0 ? (
            <div className="text-zinc-500 text-sm italic">Belum ada pesanan</div>
          ) : (
            billItems.map(item => {
              const dicoret = item.diretur || item.isVoid || item.isComp
              let label = ""
              if (item.diretur) label = "DIRETUR"
              if (item.isVoid) label = "VOID"
              if (item.isComp) label = "COMP (GRATIS)"

              return (
              <div key={item.id} className={`flex flex-col text-sm border-b border-zinc-800/50 pb-2 ${dicoret ? 'opacity-40' : ''}`}>
                <div className="flex justify-between font-medium">
                  <span className={dicoret ? 'line-through' : ''}>
                    {item.namaItem}{item.isHappyHour ? <span className="ml-1 text-[10px] text-amber-400">(HH)</span> : null}
                  </span>
                  <span className={dicoret ? 'line-through text-zinc-500' : ''}>Rp {(item.harga * item.qty).toLocaleString('id-ID')}</span>
                </div>
                {item.catatan && (
                  <span className="text-xs text-amber-400 mt-1">Catatan: {item.catatan}</span>
                )}
                <div className="flex justify-between items-center mt-1">
                  {!dicoret ? (
                    <div className="flex items-center gap-1">
                      <button onClick={async () => { setLoading(true); try { await updateItemQty(item.id, -1); router.refresh() } catch(e:any){toast.error(e.message)} finally{setLoading(false)} }} disabled={loading} className="w-5 h-5 rounded bg-zinc-700 hover:bg-red-700 text-xs font-bold flex items-center justify-center">&minus;</button>
                      <span className="text-xs w-5 text-center font-bold text-white">{item.qty}</span>
                      <button onClick={async () => { setLoading(true); try { await updateItemQty(item.id, 1); router.refresh() } catch(e:any){toast.error(e.message)} finally{setLoading(false)} }} disabled={loading} className="w-5 h-5 rounded bg-zinc-700 hover:bg-emerald-700 text-xs font-bold flex items-center justify-center">+</button>
                      <span className="text-[10px] text-zinc-600 ml-1">@ {item.harga.toLocaleString('id-ID')}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">{item.qty}x &bull; {label}</span>
                  )}
                  {!dicoret && (
                    <div className="flex gap-2">
                      <button onClick={() => { setActionItemId(item.id); setActionType("COMP") }} className="text-[10px] text-blue-400 hover:text-blue-300 transition">Comp</button>
                      <button onClick={() => { setActionItemId(item.id); setActionType("VOID") }} className="text-[10px] text-amber-400 hover:text-amber-300 transition">Void</button>
                      <button onClick={() => { setActionItemId(item.id); setActionType("RETUR") }} className="text-[10px] text-red-400 hover:text-red-300 transition">Retur</button>
                    </div>
                  )}
                </div>
              </div>
            )})
          )}
        </div>

        {/* Item Action Modal */}
        {actionItemId && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950 space-y-3">
            <div className={`text-sm font-bold ${actionType === 'RETUR' ? 'text-red-400' : actionType === 'VOID' ? 'text-amber-400' : 'text-blue-400'}`}>
              Konfirmasi {actionType}
            </div>
            <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              {approvalNotice}
            </div>
            <input 
              type="text"
              placeholder={`Alasan ${actionType.toLowerCase()} (wajib)...`}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
              value={actionAlasan}
              onChange={e => setActionAlasan(e.target.value)}
            />
            {(actionType === 'RETUR' || actionType === 'VOID' || actionType === 'COMP') && (
              <input 
                type="password"
                placeholder="PIN Manajer (Coba: 123456)..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-amber-500"
                value={actionPin}
                onChange={e => setActionPin(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => { setActionItemId(null); setActionAlasan(""); setActionPin("") }} className="px-3 py-1 bg-zinc-700 rounded text-xs">Batal</button>
              <button onClick={handleItemAction} disabled={loading} className={`flex-1 hover:brightness-110 py-1 rounded text-xs font-bold ${actionType === 'RETUR' ? 'bg-red-600' : actionType === 'VOID' ? 'bg-amber-600' : 'bg-blue-600'}`}>
                Proses {actionType}
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 rounded-b-xl space-y-2 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span>Rp {currentTotals.subtotal.toLocaleString('id-ID')}</span>
          </div>

          {/* Diskon Row */}
          <div className="flex justify-between text-zinc-400 items-center">
            <button onClick={() => setShowDiscount(!showDiscount)} className="text-red-400 hover:text-red-300 text-xs underline">
              Diskon {currentTotals.diskon > 0 ? `(- Rp ${currentTotals.diskon.toLocaleString('id-ID')})` : '(klik untuk tambah)'}
            </button>
          </div>
          {showDiscount && (
            <div className="space-y-2 rounded border border-amber-900/60 bg-amber-950/20 p-3">
              <p className="text-xs text-amber-200">Perubahan diskon memerlukan alasan dan PIN Manajer. Diskon nol juga membutuhkan otorisasi untuk menghapus diskon lama.</p>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <span>Diskon (Rp)</span>
                <input
                  type="number" min="0" step="1"
                  className="min-w-0 flex-1 bg-zinc-800 border border-zinc-700 rounded p-1 text-sm"
                  value={diskonInput}
                  onChange={e => setDiskonInput(e.target.value)}
                />
              </label>
              <input
                type="text"
                value={diskonAlasan}
                onChange={event => setDiskonAlasan(event.target.value)}
                placeholder="Alasan diskon"
                aria-label="Alasan diskon"
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm"
              />
              <input
                type="password"
                inputMode="numeric"
                value={diskonPin}
                onChange={event => setDiskonPin(event.target.value)}
                placeholder="PIN Manajer"
                aria-label="PIN Manajer untuk diskon"
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDiscount(false)
                    setDiskonAlasan("")
                    setDiskonPin("")
                  }}
                  disabled={loading}
                  className="px-3 py-1 bg-zinc-700 rounded text-xs"
                >
                  Batal
                </button>
                <button onClick={handleDiscount} disabled={loading} className="px-3 py-1 bg-emerald-600 rounded text-xs font-bold">Set</button>
              </div>
            </div>
          )}

          <div className="flex justify-between text-zinc-400">
            <span>Service Charge</span>
            <span>Rp {currentTotals.service.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Pajak</span>
            <span>Rp {currentTotals.pajak.toLocaleString('id-ID')}</span>
          </div>
          {totals.pembulatan !== 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Pembulatan</span>
              <span>Rp {totals.pembulatan.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-emerald-400 pt-2 border-t border-zinc-800 mt-2">
            <span>Total</span>
            <span>Rp {currentTotals.total.toLocaleString('id-ID')}</span>
          </div>
          {initialPayments.length > 0 && (
            <div className="space-y-2 border-t border-zinc-800 pt-2">
              {jumlahPending > 0 && (
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-2 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-300">Menunggu konfirmasi</div>
                  {initialPayments.filter(payment => payment.status === 'PENDING').map((payment, index) => (
                    <div key={`${payment.id ?? payment.metode}-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-center gap-2 text-xs text-zinc-200">
                      <span>{payment.metode} · Rp {payment.jumlah.toLocaleString('id-ID')}</span>
                      <input
                        type="text"
                        value={paymentReferences[payment.id] ?? ""}
                        onChange={event => setPaymentReferences(references => ({ ...references, [payment.id]: event.target.value }))}
                        placeholder="Referensi transaksi"
                        aria-label={`Referensi transaksi ${payment.metode}`}
                        className="min-w-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
                      />
                      <button
                        onClick={() => handleConfirmPendingPayment(payment.id)}
                        className="rounded bg-amber-600 px-2 py-1 font-bold text-white disabled:opacity-50"
                        disabled={!canOperatePayments || loading || (paymentReferences[payment.id] ?? "").trim().length < 3}
                      >
                        Konfirmasi
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {initialPayments.map((payment, index) => (
                <div key={`${payment.id ?? payment.metode}-${index}`} className="flex justify-between text-xs text-zinc-400">
                  <span>{payment.referensi || `Pembayaran awal (${payment.metode})`}{payment.status === 'PENDING' ? ' · Menunggu konfirmasi' : ''}</span>
                  <span>- Rp {payment.jumlah.toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-amber-300">
                <span>Sisa Tagihan</span>
                <span>Rp {sisaPembayaran.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}
          {depositReservasis.length > 0 && (
            <div className="space-y-2 rounded-lg border border-blue-900/60 bg-blue-950/20 p-3">
              <h4 className="text-xs font-bold text-blue-200">Deposit Reservasi</h4>
              {depositReservasis.some(reservation => !reservation.depositMetode) && (
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  Metode deposit lama
                  <select
                    value={legacyDepositMetode}
                    onChange={event => setLegacyDepositMetode(event.target.value as "TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER")}
                    className="ml-auto rounded border border-zinc-700 bg-zinc-800 p-1"
                  >
                    <option value="TUNAI">Tunai</option>
                    <option value="KARTU">Kartu</option>
                    <option value="QRIS">QRIS</option>
                    <option value="DEBIT">Debit</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </label>
              )}
              {depositReservasis.map(reservation => (
                <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-300">
                    {reservation.nama} · {new Date(reservation.jam).toLocaleString('id-ID')} · Rp {reservation.deposit.toLocaleString('id-ID')}
                  </span>
                  <button
                    onClick={() => handleApplyReservationDeposit(reservation.id)}
                    disabled={!canOperatePayments || loading || reservation.deposit > sisaPembayaran}
                    className="rounded bg-blue-700 px-2 py-1 font-bold text-white disabled:opacity-50"
                  >
                    Terapkan deposit
                  </button>
                </div>
              ))}
            </div>
          )}

          {!showPayment && !showCancel ? (
            <>
              <div className="flex gap-2 mt-4">
                <button onClick={() => window.open(`/print/bill/${billId}`, '_blank')} className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition">
                  🖨️ Cetak Bill
                </button>
                <button 
                  onClick={() => setShowCancel(true)}
                  disabled={loading}
                  className="px-4 py-3 bg-red-900/50 hover:bg-red-900 text-red-400 font-bold rounded-lg disabled:opacity-50 transition border border-red-800"
                >
                  Batal Bill
                </button>
                <button 
                  onClick={() => setShowPayment(true)}
                  disabled={!canOperatePayments || loading || initialBillItems.length === 0 || jumlahPending > 0}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {!canOperatePayments ? 'Pembayaran oleh Kasir' : jumlahPending > 0 ? 'Menunggu Konfirmasi' : sudahLunas ? 'Tutup Bill' : 'Bayar (Checkout)'}
                  <span className="text-xs bg-amber-800/70 px-1.5 py-0.5 rounded font-mono">F2</span>
                </button>
              </div>
              {!canOperatePayments && (
                <p className="mt-2 text-xs text-amber-400">Minta kasir atau manajer mencatat/mengonfirmasi pembayaran.</p>
              )}

              {/* Keyboard shortcut hints */}
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-600">
                <span><kbd className="bg-zinc-800 px-1 rounded">F2</kbd> Bayar</span>
                <span><kbd className="bg-zinc-800 px-1 rounded">F4</kbd> Diskon</span>
                <span><kbd className="bg-zinc-800 px-1 rounded">M</kbd> Filter Makanan</span>
                <span><kbd className="bg-zinc-800 px-1 rounded">B</kbd> Filter Minuman</span>
                <span><kbd className="bg-zinc-800 px-1 rounded">Esc</kbd> Tutup Panel</span>
              </div>
            </>
          ) : showCancel ? (
            <div className="mt-4 p-4 border border-red-900 bg-red-950/30 rounded-lg space-y-3">
              <h4 className="font-bold text-red-400 text-sm mb-2">Batalkan Seluruh Bill</h4>
              <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-xs text-red-200">
                Persetujuan Manager: pembatalan bill memerlukan alasan formal dan validasi PIN manajer sebelum perubahan dicatat ke audit trail.
              </div>
              <div>
                <label className="text-xs text-zinc-400">Alasan Batal</label>
                <input 
                  type="text" value={cancelAlasan} onChange={e => setCancelAlasan(e.target.value)}
                  placeholder="Misal: Tamu kabur"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-red-500 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">PIN Manajer</label>
                <input 
                  type="password" value={cancelPin} onChange={e => setCancelPin(e.target.value)}
                  placeholder="Masukkan PIN"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-red-500 mt-1"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCancel(false)} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Kembali</button>
                <button onClick={handleCancelBill} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm py-2">Konfirmasi Batal</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-4 border border-zinc-700 bg-zinc-900 rounded-lg space-y-4">
              {sisaPembayaran === 0 ? (
                <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">
                  Pembayaran sudah menutup seluruh tagihan. Konfirmasi untuk menyelesaikan bill.
                </p>
              ) : (
              <>
              <div>
                <label className="text-xs text-zinc-400">Metode Pembayaran</label>
                <div className="flex gap-2 mt-1">
                  {(["TUNAI", "KARTU", "QRIS", "DEBIT", "TRANSFER", "SPLIT"] as const).map(m => (
                    <button 
                      key={m} 
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2 rounded text-xs font-bold transition ${paymentMethod === m ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              
              {paymentMethod === "SPLIT" && (
                <div className="space-y-2 border-t border-zinc-800 pt-3">
                  <p className="text-xs text-zinc-400">Masukkan alokasi sisa nominal per metode. Total harus sama dengan sisa tagihan.</p>
                  {[
                    { label: "Tunai", value: splitCash, setValue: setSplitCash },
                    { label: "Kartu", value: splitCard, setValue: setSplitCard },
                    { label: "QRIS", value: splitQris, setValue: setSplitQris },
                    { label: "Debit", value: splitDebit, setValue: setSplitDebit },
                    { label: "Transfer", value: splitTransfer, setValue: setSplitTransfer },
                  ].map(({ label, value, setValue }) => (
                    <label key={label} className="flex items-center gap-3 text-xs text-zinc-300">
                      <span className="w-16">{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={value}
                        onChange={event => setValue(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-sm"
                      />
                    </label>
                  ))}
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Sisa alokasi</span>
                    <span className={sisaPembayaran - (Number(splitCash || 0) + Number(splitCard || 0) + Number(splitQris || 0) + Number(splitDebit || 0) + Number(splitTransfer || 0)) === 0 ? "text-emerald-400" : "text-amber-400"}>
                      Rp {(sisaPembayaran - (Number(splitCash || 0) + Number(splitCard || 0) + Number(splitQris || 0) + Number(splitDebit || 0) + Number(splitTransfer || 0))).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              )}

              {(paymentMethod === "TUNAI" || (paymentMethod === "SPLIT" && Number(splitCash) > 0)) && (
                <div className="border-t border-zinc-800 pt-2">
                  <label className="text-xs text-zinc-400">Uang Diterima (Rp)</label>
                  <input 
                    type="number" min={paymentMethod === "TUNAI" ? sisaPembayaran : Number(splitCash) || 0}
                    value={uangDiterima}
                    onChange={e => setUangDiterimaInput({ amount: e.target.value, due: sisaPembayaran })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 mt-1 focus:outline-none focus:border-emerald-500"
                  />
                  {Number(uangDiterima) >= (paymentMethod === "TUNAI" ? sisaPembayaran : Number(splitCash) || 0) && (
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-zinc-400">Kembalian</span>
                      <span className="font-bold text-emerald-400">Rp {(Number(uangDiterima) - (paymentMethod === "TUNAI" ? sisaPembayaran : Number(splitCash) || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              )}
              </>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPayment(false)} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
                <button onClick={handleClose} disabled={loading || jumlahPending > 0} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-sm py-2">
                  {sisaPembayaran === 0 ? 'Tutup Bill & Cetak Struk' : 'Konfirmasi Pembayaran'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

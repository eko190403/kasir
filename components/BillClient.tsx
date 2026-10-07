"use client"

import { useState, useEffect, useCallback } from "react"
import { addMenuItemToBill, closeBill, returnItem, applyDiscount, voidItem, compItem, updateItemQty, cancelBill } from "@/app/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function BillClient({ 
  billId, 
  menuItems,
  initialBillItems,
  totals
}: { 
  billId: string,  
  menuItems: any[],
  initialBillItems: any[],
  totals: any
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [catatan, setCatatan] = useState("")
  const [menuFilter, setMenuFilter] = useState<"SEMUA" | "MAKANAN" | "MINUMAN">("SEMUA")
  
  // Payment State
  const [showPayment, setShowPayment] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelPin, setCancelPin] = useState("")
  const [cancelAlasan, setCancelAlasan] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("TUNAI")
  const [splitWays, setSplitWays] = useState(1)
  const [uangDiterima, setUangDiterima] = useState(totals.total.toString())

  // Discount State
  const [showDiscount, setShowDiscount] = useState(false)
  const [diskonInput, setDiskonInput] = useState(totals.diskon.toString())

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

  const handleAddItem = async (menuId: string) => {
    setLoading(true)
    try {
      await addMenuItemToBill(billId, menuId, 1, catatan)
      setCatatan("")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    let kembali = 0
    let terima = parseInt(uangDiterima) || 0
    
    if (paymentMethod === "TUNAI") {
      if (terima < totals.total) {
        toast.error("Uang yang dibayar kurang dari total tagihan!")
        return
      }
      kembali = terima - totals.total
    } else {
      terima = totals.total
    }

    if(!confirm(`Yakin menyelesaikan pembayaran sebesar Rp ${totals.total.toLocaleString('id-ID')}?`)) return
    
    setLoading(true)
    try {
      await closeBill(billId, splitWays > 1 ? `SPLIT (${paymentMethod})` : paymentMethod)
      window.open(`/print/receipt/${billId}?diterima=${terima}&kembali=${kembali}&metode=${paymentMethod}`, '_blank')
      router.push("/")
    } catch(err: any) {
      toast.error(err.message)
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
    if ((actionType === "VOID" || actionType === "COMP") && !actionPin) {
      toast.warning("PIN Manajer wajib diisi untuk Void/Comp")
      return
    }
    setLoading(true)
    try {
      if (actionType === "RETUR") { await returnItem(actionItemId, actionAlasan); toast.success('Item berhasil diretur.') }
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
    setLoading(true)
    try {
      await applyDiscount(billId, parseInt(diskonInput) || 0)
      toast.success('Diskon berhasil diterapkan.')
      setShowDiscount(false)
      router.refresh()
    } catch(err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculate splits
  const calculateSplits = () => {
    const splits = []
    const base = Math.floor(totals.total / splitWays)
    let remainder = totals.total % splitWays
    for(let i=0; i<splitWays; i++) {
      splits.push(base + (remainder > 0 ? 1 : 0))
      remainder--
    }
    return splits
  }

  const filteredMenu = menuFilter === "SEMUA" 
    ? menuItems 
    : menuItems.filter(i => i.kategori === menuFilter)

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
              <button 
                key={item.id}
                onClick={() => handleAddItem(item.id)}
                disabled={!item.tersedia || loading}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 p-4 rounded-xl text-left transition relative"
              >
                <div className="font-semibold">{item.nama}</div>
                <div className="text-emerald-400 mt-1 font-medium text-sm">Rp {item.harga.toLocaleString('id-ID')}</div>
                <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${item.tersedia ? 'bg-emerald-400' : 'bg-red-500'}`} />
                {!item.tersedia && <div className="text-red-400 text-xs mt-1 font-bold">HABIS</div>}
              </button>
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
          {initialBillItems.length === 0 ? (
            <div className="text-zinc-500 text-sm italic">Belum ada pesanan</div>
          ) : (
            initialBillItems.map(item => {
              const dicoret = item.diretur || item.isVoid || item.isComp
              let label = ""
              if (item.diretur) label = "DIRETUR"
              if (item.isVoid) label = "VOID"
              if (item.isComp) label = "COMP (GRATIS)"

              return (
              <div key={item.id} className={`flex flex-col text-sm border-b border-zinc-800/50 pb-2 ${dicoret ? 'opacity-40' : ''}`}>
                <div className="flex justify-between font-medium">
                  <span className={dicoret ? 'line-through' : ''}>{item.namaItem}</span>
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
            <input 
              type="text"
              placeholder={`Alasan ${actionType.toLowerCase()} (wajib)...`}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
              value={actionAlasan}
              onChange={e => setActionAlasan(e.target.value)}
            />
            {(actionType === 'VOID' || actionType === 'COMP') && (
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
            <span>Rp {totals.subtotal.toLocaleString('id-ID')}</span>
          </div>

          {/* Diskon Row */}
          <div className="flex justify-between text-zinc-400 items-center">
            <button onClick={() => setShowDiscount(!showDiscount)} className="text-red-400 hover:text-red-300 text-xs underline">
              Diskon {totals.diskon > 0 ? `(- Rp ${totals.diskon.toLocaleString('id-ID')})` : '(klik untuk tambah)'}
            </button>
          </div>
          {showDiscount && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500">Rp</span>
              <input 
                type="number" min="0"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded p-1 text-sm"
                value={diskonInput}
                onChange={e => setDiskonInput(e.target.value)}
              />
              <button onClick={handleDiscount} disabled={loading} className="px-3 py-1 bg-emerald-600 rounded text-xs font-bold">Set</button>
            </div>
          )}

          <div className="flex justify-between text-zinc-400">
            <span>Service Charge</span>
            <span>Rp {totals.service.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Pajak</span>
            <span>Rp {totals.pajak.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-emerald-400 pt-2 border-t border-zinc-800 mt-2">
            <span>Total</span>
            <span>Rp {totals.total.toLocaleString('id-ID')}</span>
          </div>

          {!showPayment && !showCancel ? (
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
                disabled={loading || initialBillItems.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                Bayar (Checkout)
                <span className="text-xs bg-emerald-800/70 px-1.5 py-0.5 rounded font-mono">F2</span>
              </button>
            </div>

            {/* Keyboard shortcut hints */}
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-600">
              <span><kbd className="bg-zinc-800 px-1 rounded">F2</kbd> Bayar</span>
              <span><kbd className="bg-zinc-800 px-1 rounded">F4</kbd> Diskon</span>
              <span><kbd className="bg-zinc-800 px-1 rounded">M</kbd> Filter Makanan</span>
              <span><kbd className="bg-zinc-800 px-1 rounded">B</kbd> Filter Minuman</span>
              <span><kbd className="bg-zinc-800 px-1 rounded">Esc</kbd> Tutup Panel</span>
            </div>
          ) : showCancel ? (
            <div className="mt-4 p-4 border border-red-900 bg-red-950/30 rounded-lg space-y-3">
              <h4 className="font-bold text-red-400 text-sm mb-2">Batalkan Seluruh Bill</h4>
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
              <div>
                <label className="text-xs text-zinc-400">Metode Pembayaran</label>
                <div className="flex gap-2 mt-1">
                  {["TUNAI", "KARTU", "QRIS"].map(m => (
                    <button 
                      key={m} 
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2 rounded text-xs font-bold transition ${paymentMethod === m ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs text-zinc-400">Split Bill (Dibagi Rata)</label>
                <div className="flex items-center gap-4 mt-1">
                  <input 
                    type="range" min="1" max="10" 
                    value={splitWays} 
                    onChange={e => setSplitWays(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="font-bold">{splitWays} Orang</span>
                </div>
              </div>

              {splitWays > 1 && (
                <div className="text-xs text-zinc-300 space-y-1 pt-2 border-t border-zinc-800">
                  {calculateSplits().map((amt, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Orang ke-{idx+1}</span>
                      <span className="text-emerald-400">Rp {amt.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}

              {paymentMethod === "TUNAI" && (
                <div className="border-t border-zinc-800 pt-2">
                  <label className="text-xs text-zinc-400">Uang Diterima (Rp)</label>
                  <input 
                    type="number" min={totals.total}
                    value={uangDiterima}
                    onChange={e => setUangDiterima(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 mt-1 focus:outline-none focus:border-emerald-500"
                  />
                  {parseInt(uangDiterima) >= totals.total && (
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-zinc-400">Kembalian</span>
                      <span className="font-bold text-emerald-400">Rp {(parseInt(uangDiterima) - totals.total).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPayment(false)} className="px-4 py-2 bg-zinc-700 rounded-lg text-sm">Batal</button>
                <button onClick={handleClose} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm py-2">Konfirmasi Lunas</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

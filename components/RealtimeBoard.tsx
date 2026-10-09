"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { updateItemStatus, getKitchenItems } from "@/app/actions"
import { toast } from "sonner"
import { RefreshCw, ChefHat, GlassWater, Clock } from "lucide-react"
import KitchenSoundAlert from "@/components/KitchenSoundAlert"

type KitchenItem = Awaited<ReturnType<typeof getKitchenItems>>[number]

export default function RealtimeBoard({
  kategori,
  initialItems
}: {
  kategori: "MAKANAN" | "MINUMAN",
  initialItems: KitchenItem[]
}) {
  const [items, setItems] = useState<KitchenItem[]>(initialItems)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [connected, setConnected] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const connectedRef = useRef(false)
  const fetchingRef = useRef(false)
  const refreshQueuedRef = useRef(false)
  const fetchFreshRef = useRef<() => Promise<void>>(async () => {})

  const fetchFresh = useCallback(async () => {
    if (fetchingRef.current) {
      refreshQueuedRef.current = true
      return
    }

    fetchingRef.current = true
    try {
      const fresh = await getKitchenItems(kategori)
      setItems(fresh)
      setLastRefresh(new Date())
      setRefreshFailed(false)
    } catch {
      setRefreshFailed(true)
    } finally {
      fetchingRef.current = false
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false
        void fetchFreshRef.current()
      }
    }
  }, [kategori])

  // Supabase Realtime — replace polling entirely
  useEffect(() => {
    fetchFreshRef.current = fetchFresh
    const channel = supabase
      .channel(`kitchen-${kategori}-v2`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'BillItem' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch fresh data from server (includes joins with bill/sofa)
            await fetchFresh()
          } else if (payload.eventType === 'UPDATE') {
            setItems(current =>
              current.map(item =>
                item.id === payload.new.id ? { ...item, status: payload.new.status } : item
              ).filter(item => item.status !== 'SIAP')
            )
          }
        }
      )
      .subscribe((status) => {
        const isConnected = status === 'SUBSCRIBED'
        connectedRef.current = isConnected
        setConnected(isConnected)
      })

    // Fallback: re-fetch every 5s if realtime disconnects
    const fallback = setInterval(() => {
      if (!connectedRef.current) void fetchFresh()
    }, 5000)

    return () => {
      connectedRef.current = false
      supabase.removeChannel(channel)
      clearInterval(fallback)
    }
  }, [kategori, fetchFresh])

  const activeItems = items.filter(i => i.status !== "SIAP")

  const handleStatusChange = async (id: string, namaItem: string, newStatus: "DIKIRIM" | "DIPROSES" | "SIAP") => {
    const previousStatus = items.find(item => item.id === id)?.status
    if (!previousStatus) return

    // Optimistic update
    setItems(current => current.map(i => i.id === id ? { ...i, status: newStatus } : i))
    try {
      await updateItemStatus(id, newStatus)
      if (newStatus === "DIPROSES") toast.warning(`Sedang diproses: ${namaItem}`)
      if (newStatus === "SIAP") toast.success(`Siap diantar: ${namaItem}!`)
    } catch {
      toast.error("Gagal mengupdate status, coba lagi.")
      setItems(current => current.map(i => i.id === id ? { ...i, status: previousStatus } : i))
    }
  }

  const Icon = kategori === "MAKANAN" ? ChefHat : GlassWater

  return (
    <div>
      <KitchenSoundAlert newOrderCount={activeItems.length} />
      {/* Realtime status indicator */}
      <div className="flex items-center justify-between mb-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span>{activeItems.length} pesanan aktif</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          <span>{connected ? 'Realtime aktif' : 'Menghubungkan...'}</span>
          <span className="text-zinc-600">· Diperbarui {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <button
            onClick={fetchFresh}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>
      {refreshFailed && (
        <p role="alert" className="mb-4 text-sm text-amber-400">
          Gagal memuat pesanan terbaru. Periksa koneksi lalu tekan Refresh.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {activeItems.length === 0 ? (
          <div className="text-zinc-500 italic col-span-full text-center py-12">
            <Icon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Tidak ada pesanan aktif.</p>
          </div>
        ) : (
          activeItems.map(item => (
            <div key={item.id} className={`bg-zinc-900 border p-4 rounded-xl flex flex-col justify-between transition-all ${item.status === 'DIPROSES' ? 'border-amber-700 shadow-amber-900/20 shadow-lg' : 'border-zinc-800'}`}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-2xl text-emerald-400">{item.qty}x</span>
                    <span className="text-xs text-zinc-500 ml-2">{item.bill?.sofa?.nama || 'Take Away'}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-md ${item.status === 'DIPROSES' ? 'bg-amber-600 animate-pulse' : 'bg-zinc-700 text-zinc-300'}`}>
                    {item.status}
                  </span>
                </div>
                <h3 className="font-bold text-xl mb-1">{item.namaItem}</h3>
                {item.catatan && (
                  <p className="text-sm text-amber-400 italic bg-amber-900/20 p-2 rounded flex items-start gap-1">
                    <span>⚠️</span> {item.catatan}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-2 text-xs text-zinc-500">
                  <Clock className="w-3 h-3" />
                  {new Date(item.bill?.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                {item.status === "DIKIRIM" && (
                  <button
                    onClick={() => handleStatusChange(item.id, item.namaItem, "DIPROSES")}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 rounded-lg font-bold text-sm transition active:scale-95"
                  >
                    🔥 Proses
                  </button>
                )}
                {(item.status === "DIKIRIM" || item.status === "DIPROSES") && (
                  <button
                    onClick={() => handleStatusChange(item.id, item.namaItem, "SIAP")}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg font-bold text-sm transition active:scale-95"
                  >
                    ✅ Siap
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

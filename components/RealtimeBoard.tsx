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
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
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
    } catch (error) {
      setRefreshFailed(true)
      console.error("Gagal memuat pesanan dapur.", error)
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
    const initialFetch = window.setTimeout(() => void fetchFresh(), 0)
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
      clearTimeout(initialFetch)
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengupdate status, coba lagi.")
      setItems(current => current.map(i => i.id === id ? { ...i, status: previousStatus } : i))
    }
  }

  const Icon = kategori === "MAKANAN" ? ChefHat : GlassWater

  return (
    <div>
      <KitchenSoundAlert newOrderCount={activeItems.length} />
      <div className="mb-3 flex flex-col gap-2 border-y border-zinc-800 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="font-medium text-zinc-200">{activeItems.length} pesanan aktif</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">{connected ? "Terhubung" : "Menghubungkan"}</span>
          {lastRefresh && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">Pembaruan {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
            </>
          )}
        </div>
        <button
          onClick={() => void fetchFresh()}
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Segarkan
        </button>
      </div>
      {refreshFailed && (
        <p role="alert" className="mb-4 rounded-md border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-sm text-amber-300">
          Gagal memuat pesanan terbaru. Periksa koneksi lalu segarkan kembali.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {activeItems.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-800 px-5 py-12 text-center">
            <Icon className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">Tidak ada pesanan aktif.</p>
            <p className="mt-1 text-sm text-zinc-500">Pesanan baru akan muncul di sini.</p>
          </div>
        ) : (
          activeItems.map(item => (
            <article key={item.id} className={`flex min-h-56 flex-col rounded-lg border bg-zinc-900 p-4 ${item.status === "DIPROSES" ? "border-amber-800" : "border-zinc-800"}`}>
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.bill?.sofa?.nama || "Bawa pulang"}</p>
                  <h2 className="mt-1 break-words text-lg font-semibold leading-snug text-zinc-100">{item.namaItem}</h2>
                </div>
                <span className={`shrink-0 rounded border px-2 py-1 text-xs font-medium ${item.status === "DIPROSES" ? "border-amber-800 text-amber-300" : "border-zinc-700 text-zinc-300"}`}>
                  {item.status === "DIPROSES" ? "Diproses" : "Pesanan baru"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-zinc-500">Jumlah</span>
                <span className="text-xl font-semibold tabular-nums text-zinc-100">{item.qty}<span className="ml-1 text-sm font-normal text-zinc-400">porsi</span></span>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                {item.bill?.waktuBuka && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Masuk {new Date(item.bill.waktuBuka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {item.bill?.nomorBill && (
                  <span className="font-mono">Bill #{String(item.bill.nomorBill).padStart(3, "0")}</span>
                )}
              </div>
              {item.catatan && (
                <div className="mb-4 rounded-md border border-amber-900/70 bg-amber-950/20 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-400">Catatan</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-100">{item.catatan}</p>
                </div>
              )}
              <div className="mt-auto flex gap-2 border-t border-zinc-800 pt-3">
                {item.status === "DIKIRIM" && (
                  <button
                    onClick={() => handleStatusChange(item.id, item.namaItem, "DIPROSES")}
                    className="h-10 flex-1 rounded-md bg-amber-600 px-3 text-sm font-medium text-white transition-colors hover:bg-amber-500"
                  >
                    Mulai siapkan
                  </button>
                )}
                {(item.status === "DIKIRIM" || item.status === "DIPROSES") && (
                  <button
                    onClick={() => handleStatusChange(item.id, item.namaItem, "SIAP")}
                    className="h-10 flex-1 rounded-md border border-emerald-800 bg-emerald-950/30 px-3 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-900/50"
                  >
                    Tandai siap
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

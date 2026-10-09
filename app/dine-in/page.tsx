import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { connection } from "next/server"
import { ShoppingBag } from "lucide-react"
import { createTakeAwayOrder } from "@/app/actions"

export const instant = false

export default async function DineInPage() {
  await connection()

  const sofas = await prisma.sofa.findMany({
    where: { isDeleted: false },
    orderBy: { nama: 'asc' },
    include: {
      bills: {
        where: { status: 'TERBUKA' }
      }
    }
  })

  const sofaMap = new Map(sofas.map(s => [s.nama, s]))

  function SofaCard({ name, className = "" }: { name: string, className?: string }) {
    const sofa = sofaMap.get(name)
    if (!sofa) return <div className={className} />

    let bgColor = "bg-zinc-800/80 border-zinc-700"
    let statusText = "KOSONG"
    let pulseClass = ""
    switch(sofa.status) {
      case "KOSONG": bgColor = "bg-zinc-800/80 border-zinc-700 hover:border-zinc-500"; statusText = "KOSONG"; break;
      case "TERISI": bgColor = "bg-blue-950/80 border-blue-500 hover:border-blue-400"; statusText = "TERISI"; pulseClass = "shadow-blue-500/20 shadow-lg"; break;
      case "MENUNGGU_MAKANAN": bgColor = "bg-amber-950/80 border-amber-500 hover:border-amber-400"; statusText = "MENUNGGU"; pulseClass = "shadow-amber-500/20 shadow-lg animate-pulse"; break;
      case "SIAP_BAYAR": bgColor = "bg-emerald-950/80 border-emerald-500 hover:border-emerald-400"; statusText = "SIAP BAYAR"; pulseClass = "shadow-emerald-500/20 shadow-lg"; break;
    }

    // Size badge based on type
    let typeLabel = ""
    let typeBg = ""
    if (name === "VVIP") { typeLabel = "VVIP"; typeBg = "bg-red-500" }
    else if (name === "VIP") { typeLabel = "VIP"; typeBg = "bg-amber-600" }
    else if (name.startsWith("L")) { typeLabel = "L"; typeBg = "bg-pink-600" }
    else if (name.startsWith("D")) { typeLabel = "D"; typeBg = "bg-red-600" }
    else if (name.startsWith("S")) { typeLabel = "S"; typeBg = "bg-yellow-600" }

    return (
      <Link
        href={`/sofa/${sofa.id}`}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-300 cursor-pointer group ${bgColor} ${pulseClass} ${className}`}
      >
        {typeLabel && (
          <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full ${typeBg} text-white`}>
            {typeLabel}
          </span>
        )}
        <span className="text-lg font-black text-white group-hover:scale-110 transition-transform">{sofa.nama}</span>
        <span className="text-[10px] text-zinc-400 mt-0.5">{sofa.kapasitas} pax</span>
        <span className={`text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full ${
          sofa.status === 'KOSONG' ? 'bg-zinc-700 text-zinc-400' :
          sofa.status === 'TERISI' ? 'bg-blue-600 text-white' :
          sofa.status === 'MENUNGGU_MAKANAN' ? 'bg-amber-600 text-white' :
          'bg-emerald-600 text-white'
        }`}>
          {statusText}
        </span>
      </Link>
    )
  }

  return (
    <main className="container mx-auto p-4 space-y-6 max-w-5xl">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">Floor Map</h1>
          <p className="text-xs text-zinc-500 mt-1">Tap meja untuk buka bill / lihat order</p>
        </div>
        <form action={createTakeAwayOrder}>
          <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition cursor-pointer flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            New Take Away
          </button>
        </form>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-zinc-700 border border-zinc-600" /> Kosong</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-600" /> Terisi</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-600" /> Menunggu Makanan</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-600" /> Siap Bayar</div>
        <div className="ml-auto flex gap-2">
          <span className="px-1.5 py-0.5 rounded-full bg-yellow-600 text-white text-[9px] font-bold">S</span><span className="text-zinc-400">4 pax</span>
          <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold">D</span><span className="text-zinc-400">6 pax</span>
          <span className="px-1.5 py-0.5 rounded-full bg-pink-600 text-white text-[9px] font-bold">L</span><span className="text-zinc-400">8 pax</span>
        </div>
      </div>

      {/* ==================== 1ST FLOOR ==================== */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" /> 1st Floor
        </h2>

        <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-4">

          {/* Bar Area Label */}
          <div className="flex justify-center">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-8 py-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
              ☕ Bar Area
            </div>
          </div>

          {/* Row 1: D6 (left) | D1-D3 (right area) */}
          <div className="grid grid-cols-6 gap-3">
            <SofaCard name="D6" className="h-20" />
            <div /> {/* spacer */}
            <SofaCard name="D3" className="h-20" />
            <SofaCard name="D2" className="h-20" />
            <SofaCard name="D1" className="h-20" />
            <div /> {/* spacer */}
          </div>

          {/* Row 2: D5 (left) | S4 S3 (center) */}
          <div className="grid grid-cols-6 gap-3">
            <SofaCard name="D5" className="h-20" />
            <div /> {/* spacer */}
            <SofaCard name="S4" className="h-20" />
            <SofaCard name="S3" className="h-20" />
            <div /> {/* spacer */}
            <div /> {/* spacer */}
          </div>

          {/* Row 3: D4 (left) | S2 S1 (center) */}
          <div className="grid grid-cols-6 gap-3">
            <SofaCard name="D4" className="h-20" />
            <div /> {/* spacer */}
            <SofaCard name="S2" className="h-20" />
            <SofaCard name="S1" className="h-20" />
            <div /> {/* spacer */}
            <div /> {/* spacer */}
          </div>

          {/* Row 4: L3 (left) | VIP (center) | L6 (right) */}
          <div className="grid grid-cols-6 gap-3">
            <SofaCard name="L3" className="h-20" />
            <div /> {/* spacer */}
            <div className="col-span-2 flex items-center justify-center">
              <SofaCard name="VIP" className="h-20 w-full" />
            </div>
            <div /> {/* spacer */}
            <SofaCard name="L6" className="h-20" />
          </div>

          {/* Row 5: L2 (left) | Dance Floor (center) | L5 (right) */}
          <div className="grid grid-cols-6 gap-3">
            <SofaCard name="L2" className="h-20" />
            <div className="col-span-4 flex items-center justify-center">
              <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-800/50 rounded-xl px-6 py-3 text-xs font-bold text-purple-300 uppercase tracking-widest text-center w-full">
                🎵 Dance Floor
              </div>
            </div>
            <SofaCard name="L5" className="h-20" />
          </div>

          {/* Row 6: L1 (left) | Kitchen/Videotron (center) | L4 (right) */}
          <div className="grid grid-cols-6 gap-3">
            <SofaCard name="L1" className="h-20" />
            <div className="col-span-4 flex items-center justify-center gap-4">
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Kitchen
              </div>
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Videotron
              </div>
            </div>
            <SofaCard name="L4" className="h-20" />
          </div>

          {/* Entrance Label */}
          <div className="flex justify-center">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">↓ Entrance ↓</div>
          </div>
        </div>
      </section>

      {/* ==================== 2ND FLOOR ==================== */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" /> 2nd Floor
        </h2>

        <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-4">

          {/* Entrance label */}
          <div className="flex justify-center">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">↑ Entrance ↑</div>
          </div>

          {/* Row 1: S10 (left) | | S5 (right) */}
          <div className="grid grid-cols-5 gap-3">
            <SofaCard name="S10" className="h-20" />
            <div /> <div /> <div />
            <SofaCard name="S5" className="h-20" />
          </div>

          {/* Row 2: S11 (left) | | S6 (right) */}
          <div className="grid grid-cols-5 gap-3">
            <SofaCard name="S11" className="h-20" />
            <div /> <div /> <div />
            <SofaCard name="S6" className="h-20" />
          </div>

          {/* Row 3: S12 (left) | VVIP (center) | S7 (right) */}
          <div className="grid grid-cols-5 gap-3">
            <SofaCard name="S12" className="h-20" />
            <div />
            <div className="flex items-center justify-center">
              <SofaCard name="VVIP" className="h-20 w-full" />
            </div>
            <div />
            <SofaCard name="S7" className="h-20" />
          </div>

          {/* Row 4: | | | S8 (right) */}
          <div className="grid grid-cols-5 gap-3">
            <div /> <div /> <div /> <div />
            <SofaCard name="S8" className="h-20" />
          </div>

          {/* Row 5: Staff Only | S9 (right) */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-4 flex items-center justify-center">
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-6 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Staff Only Area
              </div>
            </div>
            <SofaCard name="S9" className="h-20" />
          </div>

        </div>
      </section>
    </main>
  )
}

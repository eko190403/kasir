import { notFound } from "next/navigation"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center space-y-6">
        <div className="text-8xl font-black bg-gradient-to-br from-emerald-400 to-teal-600 bg-clip-text text-transparent">
          404
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Halaman Tidak Ditemukan</h1>
          <p className="text-zinc-400 text-sm">Halaman yang Anda cari tidak ada atau sudah dipindahkan.</p>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition active:scale-95"
        >
          ← Kembali ke Beranda
        </a>
      </div>
    </div>
  )
}

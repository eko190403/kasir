import { LoaderCircle } from "lucide-react"

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4"
      role="status"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <LoaderCircle className="h-9 w-9 animate-spin text-amber-400" />
        <p className="text-sm font-medium text-zinc-300">Memuat halaman, mohon tunggu...</p>
      </div>
    </main>
  )
}

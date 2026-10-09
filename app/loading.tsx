export default function Loading() {
  return (
    <div
      aria-label="Memuat halaman"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-zinc-800/80"
      role="status"
    >
      <div className="h-full w-1/3 bg-amber-400 [animation:route-loading_1.2s_ease-in-out_infinite]" />
    </div>
  )
}

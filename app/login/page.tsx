"use client"

import { useState, useEffect } from "react"
import { loginWithUserAndPin, getActiveUsers } from "@/app/actions"
import { useRouter } from "next/navigation"
import { ChevronLeft, User } from "lucide-react"

type StafItem = { id: string; nama: string; peran: string }

const PERAN_COLOR: Record<string, string> = {
  KASIR: "text-emerald-400",
  BARTENDER: "text-blue-400",
  DAPUR: "text-amber-400",
  PELAYAN: "text-purple-400",
  MANAJER: "text-red-400",
}

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<"select" | "pin">("select")
  const [users, setUsers] = useState<StafItem[]>([])
  const [selectedUser, setSelectedUser] = useState<StafItem | null>(null)
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    getActiveUsers().then(u => {
      setUsers(u)
      setLoadingUsers(false)
    })
  }, [])

  const handleSelectUser = (user: StafItem) => {
    setSelectedUser(user)
    setPin("")
    setError("")
    setStep("pin")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setLoading(true)
    setError("")

    try {
      const res = await loginWithUserAndPin(selectedUser.id, pin)
      if (res?.error) {
        setError(res.error)
      } else if (res?.success) {
        const requestedPath = new URLSearchParams(window.location.search).get("next")
        const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.startsWith("/login")
          ? requestedPath
          : "/"
        router.replace(destination)
      }
    } catch {
      setError("Terjadi kesalahan sistem")
    } finally {
      setLoading(false)
    }
  }

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) setPin(p => p + digit)
  }

  const handlePinDelete = () => setPin(p => p.slice(0, -1))

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <p className="mb-1 text-xs font-medium text-amber-400">SISTEM KASIR</p>
          <h1 className="text-2xl font-semibold text-white">Superbar</h1>
          <p className="mt-1 text-sm text-zinc-500">Masuk menggunakan akun staf.</p>
        </div>

        {step === "select" ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-1 text-base font-semibold">Pilih akun staf</h2>
            <p className="mb-4 text-sm text-zinc-500">Pilih nama Anda untuk melanjutkan.</p>

            {loadingUsers ? (
              <div className="py-8 text-center text-sm text-zinc-500">Memuat daftar staf...</div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="group flex w-full items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/50 p-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800">
                      <User className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{user.nama}</div>
                      <div className={`text-xs font-medium ${PERAN_COLOR[user.peran] || 'text-zinc-400'}`}>{user.peran}</div>
                    </div>
                  </button>
                ))}
                {users.length === 0 && (
                  <div className="text-center py-4 text-zinc-500 italic text-sm">Tidak ada staf aktif.</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            {/* Back + user info */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => { setStep("select"); setError("") }} className="rounded-md p-1.5 transition-colors hover:bg-zinc-800">
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{selectedUser?.nama}</div>
                  <div className={`text-xs ${PERAN_COLOR[selectedUser?.peran || ''] || 'text-zinc-400'}`}>{selectedUser?.peran}</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin}>
              <p className="text-zinc-400 text-sm text-center mb-3">Masukkan PIN Anda</p>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3 mb-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      i < pin.length
                        ? "bg-amber-500 border-amber-500 scale-110"
                        : "bg-transparent border-zinc-600"
                    }`}
                  />
                ))}
              </div>

              {/* Virtual numpad */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {["1","2","3","4","5","6","7","8","9","","0","⌫"].map(d => (
                  d === "" ? <div key="empty" /> :
                  d === "⌫" ? (
                    <button key="del" type="button" onClick={handlePinDelete}
                      className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition active:scale-95 text-lg">
                      ⌫
                    </button>
                  ) : (
                    <button key={d} type="button" onClick={() => handlePinInput(d)}
                      className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xl transition active:scale-95">
                      {d}
                    </button>
                  )
                ))}
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg mb-3">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Memverifikasi..." : "Masuk →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

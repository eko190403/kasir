"use client"

import { useState } from "react"
import { loginWithPin } from "@/app/actions"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      const res = await loginWithPin(pin)
      if (res?.error) {
        setError(res.error)
      } else if (res?.success) {
        router.push("/")
      }
    } catch (err: any) {
      setError("Terjadi kesalahan sistem")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl w-full max-w-sm shadow-xl flex flex-col items-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <KeyRound className="w-8 h-8 text-emerald-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Login Kasir Bar</h1>
        <p className="text-zinc-400 text-sm mb-8 text-center">Masukkan PIN Anda untuk melanjutkan.</p>

        <div className="w-full space-y-4">
          <div>
            <input 
              type="password" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Masukkan PIN"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:border-emerald-500 transition text-white"
              required
              autoFocus
            />
          </div>
          
          {error && <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </div>
      </form>
    </div>
  )
}

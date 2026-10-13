"use client"

import { logoutUser } from "@/app/actions"
import { LogOut } from "lucide-react"

export default function LogoutButton() {
  return (
    <button 
      onClick={() => logoutUser()} 
      className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-red-400"
    >
      <LogOut className="w-4 h-4" /> Keluar
    </button>
  )
}

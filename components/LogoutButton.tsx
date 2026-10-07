"use client"

import { logoutUser } from "@/app/actions"
import { LogOut } from "lucide-react"

export default function LogoutButton() {
  return (
    <button 
      onClick={() => logoutUser()} 
      className="flex items-center gap-2 hover:text-red-400 transition text-sm font-medium text-zinc-400 ml-4 border-l border-zinc-700 pl-4"
    >
      <LogOut className="w-4 h-4" /> Keluar
    </button>
  )
}

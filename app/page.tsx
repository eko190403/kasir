import Link from "next/link"
import { createTakeAwayOrder, cleanupEmptyBills } from "./actions"
import { Utensils, ShoppingBag, Calendar, ListTodo, BookOpen, PieChart, Wallet, ChefHat, Wine, Users, Settings } from "lucide-react"

export const instant = false

export default async function Home() {
  await cleanupEmptyBills()

  const ButtonBase = "flex flex-col items-center justify-center p-6 sm:p-8 rounded-xl transition shadow-lg active:scale-95 text-center aspect-square md:aspect-auto md:h-32"
  
  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center p-4 bg-zinc-950">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* RECEIPT TYPE */}
        <section>
          <div className="bg-blue-900/40 text-blue-300 font-bold text-center py-2 mb-4 tracking-widest text-sm uppercase">Receipt Type</div>
          <div className="grid grid-cols-3 gap-4">
            <Link href="/dine-in" className={`${ButtonBase} bg-zinc-900 hover:bg-emerald-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <Utensils className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">DINE IN</span>
            </Link>
            <form action={createTakeAwayOrder} className="w-full h-full">
              <button type="submit" className={`${ButtonBase} w-full h-full bg-zinc-900 hover:bg-amber-600 border border-zinc-800 cursor-pointer text-zinc-300 hover:text-white`}>
                <ShoppingBag className="w-10 h-10 mb-3" />
                <span className="font-bold text-xs sm:text-sm">TAKE AWAY</span>
              </button>
            </form>
            <Link href="/reservasi" className={`${ButtonBase} bg-zinc-900 hover:bg-blue-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <Calendar className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">RESERVATION</span>
            </Link>
          </div>
        </section>

        {/* TRANSACTION */}
        <section>
          <div className="bg-blue-900/40 text-blue-300 font-bold text-center py-2 mb-4 tracking-widest text-sm uppercase">Transaction</div>
          <div className="grid grid-cols-4 gap-4">
            <Link href="/open-order" className={`${ButtonBase} bg-zinc-900 hover:bg-indigo-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <ListTodo className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">OPEN ORDER</span>
            </Link>
            <Link href="/menu" className={`${ButtonBase} bg-zinc-900 hover:bg-teal-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <BookOpen className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">MENU STATUS</span>
            </Link>
            <Link href="/summary" className={`${ButtonBase} bg-zinc-900 hover:bg-green-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <PieChart className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">SUMMARY</span>
            </Link>
            <Link href="/shift" className={`${ButtonBase} bg-zinc-900 hover:bg-rose-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <Wallet className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">SHIFT / KAS</span>
            </Link>
          </div>
        </section>

        {/* OPERATION */}
        <section>
          <div className="bg-blue-900/40 text-blue-300 font-bold text-center py-2 mb-4 tracking-widest text-sm uppercase">Operation</div>
          <div className="grid grid-cols-4 gap-4">
            <Link href="/kitchen" className={`${ButtonBase} bg-zinc-900 hover:bg-amber-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <ChefHat className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">KITCHEN</span>
            </Link>
            <Link href="/bar" className={`${ButtonBase} bg-zinc-900 hover:bg-blue-500 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <Wine className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">BAR DRINKS</span>
            </Link>
            <Link href="/staf" className={`${ButtonBase} bg-zinc-900 hover:bg-purple-600 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <Users className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">STAF</span>
            </Link>
            <Link href="/settings" className={`${ButtonBase} bg-zinc-900 hover:bg-zinc-700 border border-zinc-800 text-zinc-300 hover:text-white`}>
              <Settings className="w-10 h-10 mb-3" />
              <span className="font-bold text-xs sm:text-sm">SETTINGS</span>
            </Link>
          </div>
        </section>


      </div>
    </main>
  )
}

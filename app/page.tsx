import Link from "next/link"
import { createTakeAwayOrder, cleanupEmptyBills } from "./actions"
import { prisma } from "@/lib/prisma"
import { getStartOfDayWIB, getEndOfDayWIB } from "@/lib/timezone"
import { Utensils, ShoppingBag, Calendar, ListTodo, BookOpen, PieChart, Wallet, ChefHat, Wine, Users, Settings, Sparkles } from "lucide-react"

export const instant = false

export default async function Home() {
  await cleanupEmptyBills()

  const todayStart = getStartOfDayWIB()
  const todayEnd = getEndOfDayWIB()

  const [todayBills, openOrderCount, reservationCount] = await Promise.all([
    prisma.bill.findMany({
      where: { status: "LUNAS", waktuTutup: { gte: todayStart, lte: todayEnd } }
    }),
    prisma.bill.count({
      where: { status: "TERBUKA" }
    }),
    prisma.reservasi.count({
      where: { status: { in: ["PENDING", "CONFIRMED"] } }
    })
  ])

  const todayRevenue = todayBills.reduce((sum, bill) => sum + bill.total, 0)
  const avgTicket = todayBills.length ? todayRevenue / todayBills.length : 0
  const cashSales = todayBills
    .filter((bill) => ["TUNAI", "CASH"].includes((bill.metodeBayar ?? "TUNAI").trim().toUpperCase()))
    .reduce((sum, bill) => sum + bill.total, 0)
  const money = (value: number) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value)
  const buttonBase = "flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-300 shadow-lg transition hover:text-white active:scale-95 md:h-32"

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-950 p-4">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Kasir Bar</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Dashboard Operasional</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-700/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300">
            <Sparkles className="h-4 w-4" />
            {todayStart.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Pendapatan Hari Ini", value: money(todayRevenue), icon: Wallet },
            { label: "Avg Ticket", value: money(avgTicket), icon: PieChart },
            { label: "Transaksi Selesai", value: `${todayBills.length} bill`, icon: ShoppingBag },
            { label: "Cash Sales", value: money(cashSales), icon: Wallet },
            { label: "Order Masih Aktif", value: `${openOrderCount} bill`, icon: ListTodo },
            { label: "Reservasi Menunggu", value: `${reservationCount} jadwal`, icon: Calendar }
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-zinc-400">{label}</span>
                <Icon className="h-5 w-5 text-amber-400" />
              </div>
              <div className="text-xl font-black text-white">{value}</div>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-4 bg-amber-900/30 py-2 text-center text-sm font-bold uppercase tracking-widest text-amber-300">Receipt Type</div>
          <div className="grid grid-cols-3 gap-4">
            <Link href="/dine-in" className={`${buttonBase} hover:bg-amber-700`}>
              <Utensils className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">DINE IN</span>
            </Link>
            <form action={createTakeAwayOrder} className="h-full">
              <button type="submit" className={`${buttonBase} h-full w-full cursor-pointer hover:bg-amber-700`}>
                <ShoppingBag className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">TAKE AWAY</span>
              </button>
            </form>
            <Link href="/reservasi" className={`${buttonBase} hover:bg-blue-700`}>
              <Calendar className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">RESERVATION</span>
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-4 bg-amber-900/30 py-2 text-center text-sm font-bold uppercase tracking-widest text-amber-300">Transaction</div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Link href="/open-order" className={`${buttonBase} hover:bg-indigo-700`}>
              <ListTodo className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">OPEN ORDER</span>
            </Link>
            <Link href="/menu" className={`${buttonBase} hover:bg-teal-700`}>
              <BookOpen className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">MENU STATUS</span>
            </Link>
            <Link href="/summary" className={`${buttonBase} hover:bg-green-700`}>
              <PieChart className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">SUMMARY</span>
            </Link>
            <Link href="/shift" className={`${buttonBase} hover:bg-rose-700`}>
              <Wallet className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">SHIFT / KAS</span>
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-4 bg-amber-900/30 py-2 text-center text-sm font-bold uppercase tracking-widest text-amber-300">Operation</div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Link href="/kitchen" className={`${buttonBase} hover:bg-amber-700`}>
              <ChefHat className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">KITCHEN</span>
            </Link>
            <Link href="/bar" className={`${buttonBase} hover:bg-blue-700`}>
              <Wine className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">BAR DRINKS</span>
            </Link>
            <Link href="/staf" className={`${buttonBase} hover:bg-purple-700`}>
              <Users className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">STAF</span>
            </Link>
            <Link href="/settings" className={`${buttonBase} hover:bg-zinc-700`}>
              <Settings className="mb-3 h-10 w-10" /><span className="text-xs font-bold sm:text-sm">SETTINGS</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  )
}

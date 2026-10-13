import Link from "next/link"
import { connection } from "next/server"
import { createTakeAwayOrder } from "./actions"
import { prisma } from "@/lib/prisma"
import { getStartOfDayWIB, getEndOfDayWIB } from "@/lib/timezone"
import { cashSalesForBill } from "@/lib/shift-math"
import { Utensils, ShoppingBag, Calendar, ListTodo, BookOpen, PieChart, Wallet, ChefHat, Wine, Users, Settings } from "lucide-react"

export const instant = false

export default async function Home() {
  await connection()

  const todayStart = getStartOfDayWIB()
  const todayEnd = getEndOfDayWIB()

  const [todayBills, openOrderCount, reservationCount] = await Promise.all([
    prisma.bill.findMany({
      where: { status: "LUNAS", waktuTutup: { gte: todayStart, lte: todayEnd } },
      select: {
        total: true,
        metodeBayar: true,
        payments: { select: { metode: true, jumlah: true } }
      }
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
  const cashSales = todayBills.reduce((sum, bill) => sum + cashSalesForBill(bill), 0)
  const money = (value: number) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value)
  const quickActionClass = "flex min-h-20 items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 text-left text-zinc-200 transition-colors hover:border-amber-700/70 hover:bg-zinc-800 active:bg-zinc-800"
  const sectionTitleClass = "mb-3 text-sm font-semibold text-zinc-200"

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-zinc-950 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-7">
        <header className="flex flex-col gap-1 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium text-amber-400">SUPERBAR · KASIR</p>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">Operasional</h1>
          </div>
          <p className="mt-2 text-sm text-zinc-400 sm:mt-0">
            {todayStart.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </header>

        <section aria-label="Ringkasan hari ini" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Pendapatan", value: money(todayRevenue) },
            { label: "Rata-rata transaksi", value: money(avgTicket) },
            { label: "Transaksi lunas", value: `${todayBills.length} bill` },
            { label: "Pembayaran tunai", value: money(cashSales) },
            { label: "Pesanan aktif", value: `${openOrderCount} bill` },
            { label: "Reservasi", value: `${reservationCount} jadwal` }
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0 bg-zinc-900 px-4 py-4 sm:px-5">
              <p className="mb-2 text-xs text-zinc-400">{label}</p>
              <p className="truncate text-lg font-semibold tabular-nums text-zinc-100 sm:text-xl">{value}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className={sectionTitleClass}>Buat pesanan</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link href="/dine-in" className={quickActionClass}>
              <Utensils className="h-5 w-5 shrink-0 text-amber-400" />
              <span>
                <span className="block font-medium">Makan di tempat</span>
                <span className="mt-1 block text-xs text-zinc-500">Pilih meja dan mulai pesanan</span>
              </span>
            </Link>
            <form action={createTakeAwayOrder}>
              <button type="submit" className={`${quickActionClass} w-full`}>
                <ShoppingBag className="h-5 w-5 shrink-0 text-amber-400" />
                <span className="text-left">
                  <span className="block font-medium">Bawa pulang</span>
                  <span className="mt-1 block text-xs text-zinc-500">Buat pesanan tanpa meja</span>
                </span>
              </button>
            </form>
            <Link href="/reservasi" className={quickActionClass}>
              <Calendar className="h-5 w-5 shrink-0 text-amber-400" />
              <span>
                <span className="block font-medium">Reservasi</span>
                <span className="mt-1 block text-xs text-zinc-500">Lihat dan catat jadwal tamu</span>
              </span>
            </Link>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass}>Menu operasional</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link href="/open-order" className={quickActionClass}>
              <ListTodo className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Pesanan aktif</span>
            </Link>
            <Link href="/menu" className={quickActionClass}>
              <BookOpen className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Menu</span>
            </Link>
            <Link href="/kitchen" className={quickActionClass}>
              <ChefHat className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Dapur</span>
            </Link>
            <Link href="/bar" className={quickActionClass}>
              <Wine className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Bar</span>
            </Link>
            <Link href="/summary" className={quickActionClass}>
              <PieChart className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Ringkasan</span>
            </Link>
            <Link href="/shift" className={quickActionClass}>
              <Wallet className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Shift dan kas</span>
            </Link>
            <Link href="/staf" className={quickActionClass}>
              <Users className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Staf</span>
            </Link>
            <Link href="/settings" className={quickActionClass}>
              <Settings className="h-5 w-5 shrink-0 text-amber-400" /><span className="font-medium">Pengaturan</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

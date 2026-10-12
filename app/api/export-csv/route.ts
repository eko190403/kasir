import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { connection } from "next/server"
import { getSession } from "@/lib/auth"

import { getStartOfDayWIB, getEndOfDayWIB } from "@/lib/timezone"

export async function GET(req: NextRequest) {
  await connection()
  const session = await getSession()
  const actor = session?.user?.id
    ? await prisma.user.findUnique({
      where: { id: session.user.id, isDeleted: false },
      select: { peran: true }
    })
    : null
  if (!actor) return new NextResponse("Unauthorized", { status: 401 })
  if (actor.peran !== "MANAJER") return new NextResponse("Forbidden", { status: 403 })

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')

  const targetDate = dateStr ? getStartOfDayWIB(dateStr) : getStartOfDayWIB()
  const nextDate = getEndOfDayWIB(targetDate)

  const bills = await prisma.bill.findMany({
    where: {
      status: "LUNAS",
      waktuTutup: { gte: targetDate, lte: nextDate }
    },
    include: {
      sofa: true,
      kasir: true
    },
    orderBy: { waktuTutup: 'asc' }
  })

  // Create CSV Header
  let csv = "ID,Waktu Tutup,Meja/Tipe,Kasir,Subtotal,Diskon,Pajak,Service,Total,Metode Bayar\n"

  // Append Data Rows
  bills.forEach(bill => {
    const waktu = bill.waktuTutup ? new Date(bill.waktuTutup).toISOString() : ''
    const meja = bill.sofa?.nama || bill.tipe
    const kasir = bill.kasir?.nama || '-'
    
    // Escape values to prevent CSV issues
    const row = [
      bill.id,
      `"${waktu}"`,
      `"${meja}"`,
      `"${kasir}"`,
      bill.subtotal,
      bill.diskon,
      bill.pajak,
      bill.service,
      bill.total,
      `"${bill.metodeBayar}"`
    ].join(',')
    
    csv += row + "\n"
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="laporan-penjualan-${dateStr || 'hari-ini'}.csv"`
    }
  })
}

import { prisma, withSerializableRetry } from './prisma'
import type { Prisma } from '@prisma/client'
import { computeBillMathematics } from './bill-math'

export { computeBillMathematics } from './bill-math'

export async function getSettings(tx?: Prisma.TransactionClient) {
  const settings = await (tx ?? prisma).setting.findMany({
    where: { kunci: { in: ['PAJAK', 'SERVICE_CHARGE', 'PEMBULATAN_RATUSAN'] } }
  })
  const map = new Map<string, string>()
  settings.forEach(s => map.set(s.kunci, s.nilai))

  const parseRate = (key: string, fallback: number) => {
    const raw = map.get(key)
    if (raw !== undefined && raw.trim() === '') {
      throw new Error(`Pengaturan ${key} harus berupa angka antara 0 dan 100.`)
    }
    const value = raw === undefined ? fallback : Number(raw)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Pengaturan ${key} harus berupa angka antara 0 dan 100.`)
    }
    return value
  }

  const roundingSetting = map.get('PEMBULATAN_RATUSAN')
  if (roundingSetting !== undefined && !['true', 'false'].includes(roundingSetting)) {
    throw new Error('Pengaturan PEMBULATAN_RATUSAN harus bernilai true atau false.')
  }

  return {
    pajak: parseRate('PAJAK', 10),
    serviceCharge: parseRate('SERVICE_CHARGE', 5),
    pembulatanRatusan: map.get('PEMBULATAN_RATUSAN') === 'true',
  }
}

export async function calculateBillTotalInTransaction(tx: Prisma.TransactionClient, billId: string) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    include: { billItems: true }
  })

  if (!bill) throw new Error("Bill not found")
  if (bill.status !== 'TERBUKA') throw new Error('Bill sudah ditutup, total tidak dapat dihitung ulang.')

  const result = computeBillMathematics({
    items: bill.billItems,
    diskon: bill.diskon,
    pajakRate: bill.pajakPct,
    serviceRate: bill.servicePct,
    pembulatanRatusan: bill.pembulatanRatusan
  })
  const paymentTotal = await tx.payment.aggregate({
    where: { billId },
    _sum: { jumlah: true }
  })
  if ((paymentTotal._sum.jumlah ?? 0) > result.total) {
    throw new Error('Total bill tidak dapat turun di bawah deposit/pembayaran yang sudah tercatat.')
  }

  await tx.bill.update({
    where: { id: billId },
    data: {
      subtotal: result.subtotal,
      diskon: result.diskon,
      service: result.service,
      pajak: result.pajak,
      pembulatan: result.pembulatan,
      total: result.total
    }
  })

  return result
}

export async function calculateBillTotal(billId: string) {
  return withSerializableRetry((tx) => calculateBillTotalInTransaction(tx, billId))
}

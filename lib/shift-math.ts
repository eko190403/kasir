export type BillPaymentSummary = {
  total: number
  metodeBayar: string | null
  payments?: { metode: string; jumlah: number; status?: string }[]
}

function normalizeCashMethod(method?: string | null) {
  const raw = (method ?? "").trim().toUpperCase()
  if (!raw) return "TUNAI"
  if (raw === "CASH" || raw === "TUNAI") return "TUNAI"
  return raw
}

export function cashSalesForBill(bill: BillPaymentSummary): number {
  if (bill.payments && bill.payments.length > 0) {
    return bill.payments
      .filter(payment =>
        normalizeCashMethod(payment.metode) === "TUNAI" &&
        (payment.status === undefined || payment.status === "SUDAH_BAYAR")
      )
      .reduce((sum, payment) => sum + payment.jumlah, 0)
  }

  const method = normalizeCashMethod(bill.metodeBayar)
  return method === "TUNAI" ? bill.total : 0
}

export function computeShiftCash(
  kasAwal: number,
  pengeluaran: number,
  bills: BillPaymentSummary[],
  kasHitung?: number | null
) {
  const totalPenjualan = bills.reduce((sum, bill) => sum + bill.total, 0)
  const penjualanTunai = bills.reduce((sum, bill) => sum + cashSalesForBill(bill), 0)
  const expectedCash = kasAwal + penjualanTunai - pengeluaran
  return {
    totalPenjualan,
    penjualanTunai,
    expectedCash,
    selisih: kasHitung == null ? null : kasHitung - expectedCash,
  }
}

export type ShiftCashSummaryInput = {
  kasAwal: number
  pengeluaran: number
  kasHitung: number | null
  bills: BillPaymentSummary[]
}

export function summarizeShiftCash(shifts: ShiftCashSummaryInput[]) {
  const cashSales = shifts.reduce(
    (sum, shift) => sum + shift.bills.reduce((billSum, bill) => billSum + cashSalesForBill(bill), 0),
    0
  )
  const expectedCash = shifts.reduce(
    (sum, shift) => sum + computeShiftCash(shift.kasAwal, shift.pengeluaran, shift.bills).expectedCash,
    0
  )
  const actualClosingCash = shifts.reduce((sum, shift) => sum + (shift.kasHitung ?? 0), 0)
  const hasCashCounts = shifts.length > 0 && shifts.every(shift => shift.kasHitung !== null)

  return {
    cashSales,
    expectedCash,
    actualClosingCash,
    hasCashCounts,
    cashDifference: hasCashCounts ? actualClosingCash - expectedCash : null,
  }
}

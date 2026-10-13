export type BillPaymentSummary = {
  total: number
  metodeBayar: string | null
  status?: string
  payments?: { metode: string; jumlah: number; status?: string }[]
}

export type ShiftRefundSummary = {
  metode: string
  jumlah: number
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

function paidSalesForBill(bill: BillPaymentSummary): number {
  if (bill.payments && bill.payments.length > 0) {
    return bill.payments
      .filter(payment => payment.status === undefined || payment.status === "SUDAH_BAYAR")
      .reduce((sum, payment) => sum + payment.jumlah, 0)
  }

  return bill.status === "BATAL" ? 0 : bill.total
}

export function computeShiftCash(
  kasAwal: number,
  pengeluaran: number,
  bills: BillPaymentSummary[],
  kasHitung?: number | null,
  refunds: ShiftRefundSummary[] = []
) {
  const totalRefund = refunds.reduce((sum, refund) => sum + refund.jumlah, 0)
  const cashRefund = refunds
    .filter(refund => normalizeCashMethod(refund.metode) === "TUNAI")
    .reduce((sum, refund) => sum + refund.jumlah, 0)
  const totalPenjualan = bills.reduce((sum, bill) => sum + paidSalesForBill(bill), 0) - totalRefund
  const penjualanTunai = bills.reduce((sum, bill) => sum + cashSalesForBill(bill), 0)
  const expectedCash = kasAwal + penjualanTunai - cashRefund - pengeluaran
  return {
    totalPenjualan,
    penjualanTunai,
    cashRefund,
    expectedCash,
    selisih: kasHitung == null ? null : kasHitung - expectedCash,
  }
}

export type ShiftCashSummaryInput = {
  kasAwal: number
  pengeluaran: number
  kasHitung: number | null
  bills: BillPaymentSummary[]
  refunds?: ShiftRefundSummary[]
}

export function summarizeShiftCash(shifts: ShiftCashSummaryInput[]) {
  const cashSales = shifts.reduce(
    (sum, shift) => sum + shift.bills.reduce((billSum, bill) => billSum + cashSalesForBill(bill), 0) -
      (shift.refunds ?? []).filter(refund => normalizeCashMethod(refund.metode) === "TUNAI")
        .reduce((refundSum, refund) => refundSum + refund.jumlah, 0),
    0
  )
  const expectedCash = shifts.reduce(
    (sum, shift) => sum + computeShiftCash(shift.kasAwal, shift.pengeluaran, shift.bills, undefined, shift.refunds).expectedCash,
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

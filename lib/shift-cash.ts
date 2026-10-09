export type ShiftCashBill = {
  total: number
  metodeBayar: string | null
}

export type ShiftCashInput = {
  kasAwal: number
  pengeluaran: number
  kasHitung: number | null
  bills: ShiftCashBill[]
}

export function cashSalesForBill(bill: ShiftCashBill): number {
  const method = (bill.metodeBayar ?? "TUNAI").trim().toUpperCase()
  const cashPayment = method === "TUNAI"
    || method === "CASH"
    || /^SPLIT\s*\(\s*(TUNAI|CASH)\s*\)$/.test(method)

  return cashPayment ? bill.total : 0
}

export function summarizeShiftCash(shifts: ShiftCashInput[]) {
  const cashSales = shifts.reduce(
    (sum, shift) => sum + shift.bills.reduce((billSum, bill) => billSum + cashSalesForBill(bill), 0),
    0
  )
  const expectedCash = shifts.reduce(
    (sum, shift) => sum + shift.kasAwal + shift.bills.reduce((billSum, bill) => billSum + cashSalesForBill(bill), 0) - shift.pengeluaran,
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

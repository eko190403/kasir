import { describe, expect, test } from "vitest"
import { cashSalesForBill, summarizeShiftCash } from "./shift-cash"

describe("shift cash reconciliation", () => {
  test("counts full cash sales for cash, including split bills paid in cash", () => {
    expect(cashSalesForBill({ total: 100_000, metodeBayar: "TUNAI" })).toBe(100_000)
    expect(cashSalesForBill({ total: 100_000, metodeBayar: "SPLIT (TUNAI)" })).toBe(100_000)
    expect(cashSalesForBill({ total: 100_000, metodeBayar: "SPLIT (QRIS)" })).toBe(0)
  })

  test("keeps reconciliation pending until every shift has a physical count", () => {
    expect(summarizeShiftCash([
      {
        kasAwal: 100_000,
        pengeluaran: 10_000,
        kasHitung: 140_000,
        bills: [{ total: 50_000, metodeBayar: "TUNAI" }],
      },
      {
        kasAwal: 200_000,
        pengeluaran: 0,
        kasHitung: null,
        bills: [{ total: 25_000, metodeBayar: "QRIS" }],
      },
    ])).toEqual({
      cashSales: 50_000,
      expectedCash: 340_000,
      actualClosingCash: 140_000,
      hasCashCounts: false,
      cashDifference: null,
    })
  })

  test("calculates the difference from the physical cash count", () => {
    expect(summarizeShiftCash([
      {
        kasAwal: 200_000,
        pengeluaran: 25_000,
        kasHitung: 270_000,
        bills: [
          { total: 100_000, metodeBayar: "TUNAI" },
          { total: 80_000, metodeBayar: "QRIS" },
        ],
      },
    ])).toEqual({
      cashSales: 100_000,
      expectedCash: 275_000,
      actualClosingCash: 270_000,
      hasCashCounts: true,
      cashDifference: -5_000,
    })
  })
})

import { describe, expect, test } from "vitest"
import { cashSalesForBill, computeShiftCash, summarizeShiftCash } from "./shift-math"

describe("cash reconciliation", () => {
  test("counts only the cash allocation from a split bill", () => {
    expect(cashSalesForBill({
      total: 100_000,
      metodeBayar: "SPLIT (TUNAI+QRIS)",
      payments: [
        { metode: "TUNAI", jumlah: 40_000 },
        { metode: "QRIS", jumlah: 60_000 },
      ],
    })).toBe(40_000)
  })

  test("does not count pending, failed, or cancelled cash payments in the drawer total", () => {
    expect(cashSalesForBill({
      total: 100_000,
      metodeBayar: "SPLIT (TUNAI+QRIS)",
      payments: [
        { metode: "TUNAI", jumlah: 40_000, status: "SUDAH_BAYAR" },
        { metode: "TUNAI", jumlah: 10_000, status: "PENDING" },
        { metode: "TUNAI", jumlah: 5_000, status: "GAGAL" },
        { metode: "QRIS", jumlah: 45_000, status: "SUDAH_BAYAR" },
      ],
    })).toBe(40_000)
  })

  test("falls back to the stored method for historical single-method bills", () => {
    expect(cashSalesForBill({ total: 75_000, metodeBayar: "TUNAI" })).toBe(75_000)
    expect(cashSalesForBill({ total: 75_000, metodeBayar: "QRIS" })).toBe(0)
  })

  test("computes expected cash and physical difference", () => {
    expect(computeShiftCash(
      200_000,
      25_000,
      [
        { total: 100_000, metodeBayar: "TUNAI" },
        { total: 80_000, metodeBayar: "QRIS" },
      ],
      270_000
    )).toEqual({
      totalPenjualan: 180_000,
      penjualanTunai: 100_000,
      cashRefund: 0,
      expectedCash: 275_000,
      selisih: -5_000,
    })
  })

  test("reconciles each shift using its own bills and keeps uncounted shifts pending", () => {
    const shifts = [
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
    ]

    expect(summarizeShiftCash(shifts)).toEqual({
      cashSales: 50_000,
      expectedCash: 340_000,
      actualClosingCash: 140_000,
      hasCashCounts: false,
      cashDifference: null,
    })
  })

  test("sums counted differences only when every shift has a physical count", () => {
    expect(summarizeShiftCash([
      {
        kasAwal: 100_000,
        pengeluaran: 10_000,
        kasHitung: 145_000,
        bills: [{ total: 50_000, metodeBayar: "TUNAI" }],
      },
      {
        kasAwal: 200_000,
        pengeluaran: 0,
        kasHitung: 200_000,
        bills: [{ total: 25_000, metodeBayar: "QRIS" }],
      },
    ])).toEqual({
      cashSales: 50_000,
      expectedCash: 340_000,
      actualClosingCash: 345_000,
      hasCashCounts: true,
      cashDifference: 5_000,
    })
  })
})

import { describe, expect, test } from "vitest"
import { nextShiftExpenseTotal, normalizeShiftExpenseInput } from "./shift-expense"

describe("shift expense validation", () => {
  test("requires a positive safe whole-rupiah amount and a note", () => {
    expect(normalizeShiftExpenseInput(25_000, "  Beli es  ")).toEqual({
      jumlah: 25_000,
      catatan: "Beli es",
    })
    expect(() => normalizeShiftExpenseInput(0, "Beli es")).toThrow()
    expect(() => normalizeShiftExpenseInput(-1, "Beli es")).toThrow()
    expect(() => normalizeShiftExpenseInput(1.5, "Beli es")).toThrow()
    expect(() => normalizeShiftExpenseInput(2_147_483_648, "Beli es")).toThrow()
    expect(() => normalizeShiftExpenseInput(1_000, "   ")).toThrow()
  })

  test("rejects an expense total outside the database integer range", () => {
    expect(nextShiftExpenseTotal(10_000, 5_000)).toBe(15_000)
    expect(() => nextShiftExpenseTotal(2_147_483_647, 1)).toThrow()
  })
})

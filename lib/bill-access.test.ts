import { describe, expect, test } from "vitest"
import { canAccessBill } from "./bill-access"

describe("bill access", () => {
  test("allows the bill owner", () => {
    expect(canAccessBill("KASIR", "cashier-1", "cashier-1")).toBe(true)
  })

  test("denies other POS users access to an unowned bill", () => {
    for (const role of ["KASIR", "PELAYAN", "BARTENDER"]) {
      expect(canAccessBill(role, "user-1", "user-2")).toBe(false)
      expect(canAccessBill(role, "user-1", null)).toBe(false)
    }
  })

  test("allows manager access and explicitly authorized actions", () => {
    expect(canAccessBill("MANAJER", "manager-1", "cashier-1")).toBe(true)
    expect(canAccessBill("KASIR", "cashier-1", "cashier-2", true)).toBe(true)
  })
})

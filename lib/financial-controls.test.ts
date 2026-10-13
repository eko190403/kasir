import { describe, expect, test } from "vitest"
import { paymentStatusForMethod, validatePaymentReference } from "./financial-controls"

describe("financial payment controls", () => {
  test.each(["QRIS", "DEBIT", "TRANSFER"])("%s requires confirmation", method => {
    expect(paymentStatusForMethod(method)).toBe("PENDING")
  })

  test.each(["TUNAI", "KARTU"])("%s is recorded as paid at checkout", method => {
    expect(paymentStatusForMethod(method)).toBe("SUDAH_BAYAR")
  })

  test("rejects unsupported payment methods", () => {
    expect(() => paymentStatusForMethod("CRYPTO")).toThrow("Metode pembayaran tidak valid.")
  })

  test("requires a trimmed payment reference within the supported length", () => {
    expect(validatePaymentReference("  TXN-123  ")).toBe("TXN-123")
    expect(() => validatePaymentReference("  ")).toThrow("wajib diisi")
    expect(() => validatePaymentReference("ab")).toThrow("3–120 karakter")
    expect(() => validatePaymentReference("x".repeat(121))).toThrow("3–120 karakter")
  })
})

import { describe, expect, test } from "vitest"
import { csvCell } from "./csv"

describe("CSV cells", () => {
  test("quotes fields and escapes embedded quotes", () => {
    expect(csvCell('Bar "Utama", Bali')).toBe('"Bar ""Utama"", Bali"')
  })

  test("neutralizes spreadsheet formula prefixes, including leading whitespace", () => {
    for (const value of ["=1+1", "+cmd", "-1+1", "@SUM(A1:A2)", "\t=1+1"]) {
      expect(csvCell(value)).toBe(`"'${value}"`)
    }
  })

  test("leaves ordinary text and numeric values intact", () => {
    expect(csvCell("Meja 1")).toBe('"Meja 1"')
    expect(csvCell(12500)).toBe('"12500"')
    expect(csvCell(null)).toBe('""')
  })
})

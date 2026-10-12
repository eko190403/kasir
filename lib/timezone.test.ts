import { describe, expect, test } from "vitest"
import { getOperationalBusinessDate, getStartOfDayWIB, isTimeWithinRange } from "./timezone"

describe("operational day and happy-hour time ranges", () => {
  test("starts a business date at 06:00 WIB", () => {
    expect(getStartOfDayWIB("2026-10-08").toISOString()).toBe("2026-10-07T23:00:00.000Z")
    expect(getOperationalBusinessDate(new Date("2026-10-07T22:59:59.000Z")).toISOString())
      .toBe("2026-10-07T00:00:00.000Z")
    expect(getOperationalBusinessDate(new Date("2026-10-07T23:00:00.000Z")).toISOString())
      .toBe("2026-10-08T00:00:00.000Z")
  })

  test("handles regular and overnight happy-hour windows", () => {
    expect(isTimeWithinRange("18:00", "17:00", "20:00")).toBe(true)
    expect(isTimeWithinRange("21:00", "17:00", "20:00")).toBe(false)
    expect(isTimeWithinRange("23:00", "22:00", "02:00")).toBe(true)
    expect(isTimeWithinRange("01:00", "22:00", "02:00")).toBe(true)
    expect(isTimeWithinRange("12:00", "22:00", "02:00")).toBe(false)
  })

  test("rejects malformed happy-hour times", () => {
    expect(() => isTimeWithinRange("9:00", "17:00", "20:00")).toThrow()
  })
})

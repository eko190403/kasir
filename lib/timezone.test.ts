import { describe, expect, test } from "vitest"
import { getOperationalBusinessDate } from "./timezone"

describe("operational business date", () => {
  test("uses the prior business date before 06:00 WIB", () => {
    expect(getOperationalBusinessDate(new Date("2026-10-08T22:59:59.000Z")))
      .toEqual(new Date("2026-10-08T00:00:00.000Z"))
  })

  test("starts a new business date at 06:00 WIB", () => {
    expect(getOperationalBusinessDate(new Date("2026-10-08T23:00:00.000Z")))
      .toEqual(new Date("2026-10-09T00:00:00.000Z"))
  })
})

import { describe, expect, test } from "vitest"
import {
  applyHappyHourDiscount,
  getHappyHourOriginalPrice,
  happyHourMenuPrefix,
  isHappyHourMenuName,
  isHappyHourWindowActive,
  menuCatalog,
  resolveHappyHourPrice
} from "./menu-catalog"

describe("LSD October menu catalog", () => {
  test("contains unique menu names with positive whole-rupiah prices", () => {
    const names = menuCatalog.map(item => item.nama.toLocaleLowerCase("id-ID"))
    expect(new Set(names).size).toBe(menuCatalog.length)
    expect(menuCatalog.every(item => Number.isSafeInteger(item.harga) && item.harga > 0)).toBe(true)
  })

  test("keeps nett menu prices and happy-hour reference prices from the PDF", () => {
    expect(menuCatalog.find(item => item.nama === "Cheezy Fries / 150gr")?.harga).toBe(40_000)
    expect(menuCatalog.find(item => item.nama === "Clase Azul Reposado")?.harga).toBe(10_500_000)
    const happyHourName = `${happyHourMenuPrefix}Carson Vodka + Free Mixer`
    expect(menuCatalog.find(item => item.nama === happyHourName)?.harga).toBe(399_000)
    expect(getHappyHourOriginalPrice(happyHourName)).toBe(559_000)
    expect(getHappyHourOriginalPrice("HAPPY HOUR 21-23 - unknown")).toBeNull()
  })

  test("detects happy-hour menu names and rounds pricing safely", () => {
    const happyHourName = `${happyHourMenuPrefix}Carson Vodka + Free Mixer`
    expect(isHappyHourMenuName(happyHourName)).toBe(true)
    expect(isHappyHourMenuName("Smirnoff Red")).toBe(false)
    expect(applyHappyHourDiscount(559_000, 20)).toBe(447_200)
    expect(applyHappyHourDiscount(559_000, 150)).toBe(0)
  })

  test("handles happy-hour window boundaries and resolves pricing consistently", () => {
    expect(isHappyHourWindowActive("20:59", "21:00", "23:00")).toBe(false)
    expect(isHappyHourWindowActive("21:00", "21:00", "23:00")).toBe(true)
    expect(isHappyHourWindowActive("23:00", "21:00", "23:00")).toBe(true)
    expect(isHappyHourWindowActive("23:01", "21:00", "23:00")).toBe(false)

    const resolved = resolveHappyHourPrice(
      `${happyHourMenuPrefix}Carson Vodka + Free Mixer`,
      559_000,
      20,
      "21:30"
    )

    expect(resolved.isFixedHappyHour).toBe(true)
    expect(resolved.isActive).toBe(true)
    expect(resolved.originalPrice).toBe(559_000)
    expect(resolved.finalPrice).toBe(447_200)
  })
})

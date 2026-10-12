import { describe, expect, it } from "vitest"
import { safeNextPath } from "./proxy"

describe("safeNextPath", () => {
  it("accepts same-origin relative paths and preserves query string", () => {
    expect(safeNextPath("/menu?tab=all", "/", "https://kasir.example.com/login")).toBe("/menu?tab=all")
  })

  it("rejects external absolute URLs", () => {
    expect(safeNextPath("https://evil.example.com/steal", "/", "https://kasir.example.com/login")).toBe("/")
  })

  it("rejects protocol-relative URLs and login route", () => {
    expect(safeNextPath("//evil.example.com", "/", "https://kasir.example.com/login")).toBe("/")
    expect(safeNextPath("/login", "/", "https://kasir.example.com/login")).toBe("/")
  })
})

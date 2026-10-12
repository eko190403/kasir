import { describe, expect, test } from "vitest"
import { selectTargetManagerForFailedPinAttempt } from "./manager-pin-lock"

describe("manager PIN lock selection", () => {
  test("prefers the manager with the highest failed-attempt count instead of the first account", () => {
    const now = new Date("2026-10-11T12:00:00Z")
    const managers = [
      { id: "manager-a", failedAttempts: 1 },
      { id: "manager-b", failedAttempts: 4 },
      { id: "manager-c", failedAttempts: 3 },
    ]

    expect(selectTargetManagerForFailedPinAttempt(managers, now)).toBe("manager-b")
  })

  test("ignores locked managers when choosing the target for the next lockout", () => {
    const now = new Date("2026-10-11T12:00:00Z")
    const managers = [
      { id: "manager-a", failedAttempts: 1, lockedUntil: now },
      { id: "manager-b", failedAttempts: 2, lockedUntil: null },
    ]

    expect(selectTargetManagerForFailedPinAttempt(managers, now)).toBe("manager-b")
  })
})

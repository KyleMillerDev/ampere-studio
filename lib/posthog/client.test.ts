import { describe, expect, it } from "vitest"

import { asNumber, asString, changeRatio } from "@/lib/posthog/client"

describe("analytics metric helpers", () => {
  it("parses finite numbers and falls back to 0", () => {
    expect(asNumber(12)).toBe(12)
    expect(asNumber("3.5")).toBe(3.5)
    expect(asNumber("")).toBe(0)
    expect(asNumber(null)).toBe(0)
    expect(asNumber(Number.NaN)).toBe(0)
  })

  it("stringifies cells safely", () => {
    expect(asString(null)).toBe("")
    expect(asString(42)).toBe("42")
    expect(asString("home")).toBe("home")
  })

  it("computes comparison change ratios", () => {
    expect(changeRatio(120, 100)).toBeCloseTo(0.2)
    expect(changeRatio(80, 100)).toBeCloseTo(-0.2)
    expect(changeRatio(50, 0)).toBeNull()
    expect(changeRatio(50, null)).toBeNull()
  })
})

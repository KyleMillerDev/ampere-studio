import { describe, expect, it } from "vitest"

import {
  addressToSlug,
  normalizePropertyType,
} from "@/lib/validation/rental.schema"

describe("addressToSlug", () => {
  it("uses street number and slugified street name", () => {
    expect(addressToSlug({ street: "108 Main St" })).toBe("108-main-st")
  })

  it("slugifies streets without a leading number", () => {
    expect(addressToSlug({ street: "Oak Avenue" })).toBe("oak-avenue")
  })
})

describe("normalizePropertyType", () => {
  it("accepts canonical slugs", () => {
    expect(normalizePropertyType("single-family")).toBe("single-family")
    expect(normalizePropertyType("commercial")).toBe("commercial")
  })

  it("maps human-readable labels to slugs", () => {
    expect(normalizePropertyType("Single Family")).toBe("single-family")
    expect(normalizePropertyType("Multi Family")).toBe("multi-family")
  })

  it("maps removed legacy types to single-family", () => {
    expect(normalizePropertyType("condo")).toBe("single-family")
    expect(normalizePropertyType("townhouse")).toBe("single-family")
  })
})

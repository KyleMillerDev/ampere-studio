import { describe, expect, it } from "vitest"

import {
  getAvailableAmenitySuggestions,
  hasAmenityTag,
  RENTAL_AMENITY_SUGGESTIONS,
} from "@/lib/constants/rental-amenity-suggestions"

describe("rental-amenity-suggestions", () => {
  it("includes 25 common rental amenity suggestions", () => {
    expect(RENTAL_AMENITY_SUGGESTIONS).toHaveLength(25)
  })

  it("hides suggestions already selected", () => {
    const available = getAvailableAmenitySuggestions(["Central Air", "Garage"])

    expect(available).not.toContain("Central Air")
    expect(available).not.toContain("Garage")
    expect(available).toContain("Pet Friendly")
  })

  it("matches tags case-insensitively", () => {
    expect(hasAmenityTag(["central air"], "Central Air")).toBe(true)
    expect(getAvailableAmenitySuggestions(["central air"])).not.toContain(
      "Central Air"
    )
  })
})

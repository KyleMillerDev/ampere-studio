import { describe, expect, it } from "vitest"

import {
  matchRentalCounty,
  normalizeGoogleCountyName,
  parseGooglePlace,
} from "@/lib/google/parse-google-place"

describe("normalizeGoogleCountyName", () => {
  it("removes a trailing County suffix", () => {
    expect(normalizeGoogleCountyName("Davis County")).toBe("Davis")
  })

  it("leaves names without a County suffix unchanged", () => {
    expect(normalizeGoogleCountyName("Van Buren")).toBe("Van Buren")
  })
})

describe("matchRentalCounty", () => {
  it("matches supported counties case-insensitively", () => {
    expect(matchRentalCounty("wapello county")).toBe("Wapello")
  })

  it("returns undefined for counties outside the service area", () => {
    expect(matchRentalCounty("Polk County")).toBeUndefined()
  })
})

describe("parseGooglePlace", () => {
  it("includes a matched county from administrative_area_level_2", () => {
    const parsed = parseGooglePlace({
      address_components: [
        { long_name: "108", short_name: "108", types: ["street_number"] },
        { long_name: "Main Street", short_name: "Main St", types: ["route"] },
        {
          long_name: "Bloomfield",
          short_name: "Bloomfield",
          types: ["locality"],
        },
        {
          long_name: "Davis County",
          short_name: "Davis County",
          types: ["administrative_area_level_2", "political"],
        },
        {
          long_name: "Iowa",
          short_name: "IA",
          types: ["administrative_area_level_1", "political"],
        },
        { long_name: "52537", short_name: "52537", types: ["postal_code"] },
      ],
      geometry: {
        location: {
          lat: () => 40.751,
          lng: () => -92.414,
        },
      },
    })

    expect(parsed).toMatchObject({
      street: "108 Main Street",
      city: "Bloomfield",
      state: "IA",
      zip: "52537",
      county: "Davis",
    })
  })
})

import { describe, expect, it } from "vitest"

import {
  isRealtyClient,
  showAnalyticsInOverview,
  showAnalyticsNav,
  type ClientFeatures,
} from "@/lib/cms/client-features"

const baseFeatures: ClientFeatures = {
  catalog: null,
  blog: false,
  analytics: true,
  siteEditor: false,
  rentals: false,
  submissions: false,
}

describe("realty analytics routing", () => {
  it("treats rentals workspaces as realty clients", () => {
    expect(isRealtyClient({ ...baseFeatures, rentals: true })).toBe(true)
    expect(isRealtyClient(baseFeatures)).toBe(false)
  })

  it("shows analytics on overview for realty clients with analytics enabled", () => {
    expect(
      showAnalyticsInOverview({
        ...baseFeatures,
        rentals: true,
        analytics: true,
      })
    ).toBe(true)
    expect(
      showAnalyticsInOverview({
        ...baseFeatures,
        rentals: true,
        analytics: false,
      })
    ).toBe(false)
  })

  it("hides analytics nav for realty clients", () => {
    expect(showAnalyticsNav({ ...baseFeatures, rentals: true })).toBe(false)
    expect(showAnalyticsNav(baseFeatures)).toBe(true)
    expect(showAnalyticsNav({ ...baseFeatures, analytics: false })).toBe(false)
  })
})

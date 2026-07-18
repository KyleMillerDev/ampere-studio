import { describe, expect, it } from "vitest"

import { userFacingAnalyticsMessage } from "@/lib/analytics/user-facing"

describe("userFacingAnalyticsMessage", () => {
  it("scrubs provider names and credential-shaped tokens", () => {
    expect(
      userFacingAnalyticsMessage("Could not reach PostHog. Key phx_abc123")
    ).toBe("Could not reach Ampere Sites. Key [redacted]")
  })

  it("leaves already-safe analytics copy unchanged", () => {
    expect(userFacingAnalyticsMessage("Could not load this widget.")).toBe(
      "Could not load this widget."
    )
  })
})

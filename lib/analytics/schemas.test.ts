import { describe, expect, it } from "vitest"

import {
  analyticsDashboardRequestSchema,
  analyticsFilterClauseSchema,
  analyticsGlobalFiltersSchema,
  analyticsLayoutPutSchema,
} from "@/lib/analytics/schemas"
import { ANALYTICS_LAYOUT_VERSION } from "@/lib/analytics/types"

const validFilters = {
  dateRange: { from: "2026-06-01", to: "2026-06-30" },
  comparisonRange: { from: "2026-05-02", to: "2026-05-31" },
  granularity: "day" as const,
  clauses: [
    {
      id: "f1",
      dimension: "page" as const,
      operator: "is" as const,
      values: ["/"],
    },
  ],
}

describe("analytics filter and layout validation", () => {
  it("accepts a well-formed dashboard request", () => {
    const parsed = analyticsDashboardRequestSchema.safeParse({
      widgetIds: ["visitors", "pageviews"],
      filters: validFilters,
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects unknown dimensions, operators, and widget ids", () => {
    expect(
      analyticsFilterClauseSchema.safeParse({
        id: "x",
        dimension: "password",
        operator: "is",
        values: ["x"],
      }).success
    ).toBe(false)

    expect(
      analyticsFilterClauseSchema.safeParse({
        id: "x",
        dimension: "page",
        operator: "regex",
        values: ["x"],
      }).success
    ).toBe(false)

    expect(
      analyticsDashboardRequestSchema.safeParse({
        widgetIds: ["not_a_real_widget"],
        filters: validFilters,
      }).success
    ).toBe(false)
  })

  it("caps clause values and rejects bad dates", () => {
    expect(
      analyticsGlobalFiltersSchema.safeParse({
        ...validFilters,
        dateRange: { from: "06-01-2026", to: "2026-06-30" },
      }).success
    ).toBe(false)

    expect(
      analyticsFilterClauseSchema.safeParse({
        id: "x",
        dimension: "page",
        operator: "is",
        values: Array.from({ length: 51 }, (_, i) => `/${i}`),
      }).success
    ).toBe(false)
  })

  it("requires layout version and known widgets on PUT", () => {
    expect(
      analyticsLayoutPutSchema.safeParse({
        version: ANALYTICS_LAYOUT_VERSION,
        widgetIds: ["visitors"],
        layouts: {
          lg: [{ i: "visitors", x: 0, y: 0, w: 4, h: 2 }],
          md: [{ i: "visitors", x: 0, y: 0, w: 4, h: 2 }],
          sm: [{ i: "visitors", x: 0, y: 0, w: 12, h: 3 }],
        },
      }).success
    ).toBe(true)

    expect(
      analyticsLayoutPutSchema.safeParse({
        version: 999,
        widgetIds: ["visitors"],
        layouts: { lg: [], md: [], sm: [] },
      }).success
    ).toBe(false)
  })
})

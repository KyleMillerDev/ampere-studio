import { describe, expect, it } from "vitest"

import type { AnalyticsGlobalFilters } from "@/lib/analytics/types"
import {
  DIRECT_SOURCE_LABEL,
  NEW_VISITOR_DEFINITION,
  buildNewReturningBySourceQuery,
  parseSourceVisitorBreakdownRows,
  sourceVisitorBreakdownTotal,
} from "@/lib/posthog/source-visitor-breakdown"

const evilValue = "evil']; DROP TABLE events; --"

const filters: AnalyticsGlobalFilters = {
  dateRange: { from: "2026-06-01", to: "2026-06-30" },
  comparisonRange: null,
  granularity: "day",
  clauses: [
    {
      id: "f1",
      dimension: "source",
      operator: "is",
      values: ["google.com", evilValue],
    },
  ],
}

describe("new returning by source query", () => {
  it("documents a defensible new-visitor definition", () => {
    expect(NEW_VISITOR_DEFINITION).toMatch(/\$is_first_session/)
    expect(NEW_VISITOR_DEFINITION.toLowerCase()).toContain("first")
  })

  it("binds user filter values and the Direct label instead of interpolating them", () => {
    const query = buildNewReturningBySourceQuery(filters, { limit: 25 })

    expect(query.sql).toContain("properties.$referring_domain")
    expect(query.sql).toContain("properties.$is_first_session")
    expect(query.sql).toContain("count(DISTINCT if(")
    expect(query.sql).toMatch(/event = \{ev_name_\d+\}/)
    expect(query.sql).toMatch(/LIMIT \{brk_limit_\d+\}/)
    expect(query.sql).not.toContain("google.com")
    expect(query.sql).not.toContain("DROP TABLE")
    expect(query.sql).not.toContain(DIRECT_SOURCE_LABEL)

    const bound = Object.values(query.values)
    expect(bound).toContain("$pageview")
    expect(bound).toContainEqual(["google.com", evilValue])
    expect(bound).toContain(DIRECT_SOURCE_LABEL)
    expect(bound).toContain(25)
  })
})

describe("parseSourceVisitorBreakdownRows", () => {
  it("maps HogQL tuples into typed rows with share of combined totals", () => {
    const rows = parseSourceVisitorBreakdownRows([
      ["google.com", 8, 2],
      [null, 3, 7],
      ["facebook.com", 0, 0],
      "skip-me",
    ])

    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      key: "google.com",
      label: "google.com",
      newVisitors: 8,
      returningVisitors: 2,
      total: 10,
      share: 0.5,
    })
    expect(rows[1]).toMatchObject({
      key: DIRECT_SOURCE_LABEL,
      newVisitors: 3,
      returningVisitors: 7,
      total: 10,
      share: 0.5,
    })
    expect(rows[2]).toMatchObject({
      key: "facebook.com",
      total: 0,
    })
    expect(sourceVisitorBreakdownTotal(rows)).toBe(20)
  })

  it("clamps negative numeric cells and ignores non-array rows", () => {
    const rows = parseSourceVisitorBreakdownRows([
      ["a.com", -2, 5],
      { not: "a row" },
    ])
    expect(rows).toEqual([
      {
        key: "a.com",
        label: "a.com",
        newVisitors: 0,
        returningVisitors: 5,
        total: 5,
        share: 1,
      },
    ])
  })

  it("keeps New and Returning columns independent when one side is zero", () => {
    const rows = parseSourceVisitorBreakdownRows([
      ["newsletter", 12, 0],
      ["google.com", 0, 9],
    ])
    expect(rows[0]).toMatchObject({
      newVisitors: 12,
      returningVisitors: 0,
      total: 12,
    })
    expect(rows[1]).toMatchObject({
      newVisitors: 0,
      returningVisitors: 9,
      total: 9,
    })
    expect(sourceVisitorBreakdownTotal(rows)).toBe(21)
  })

  it("coerces string numeric cells from HogQL", () => {
    const rows = parseSourceVisitorBreakdownRows([["bing.com", "4", "6"]])
    expect(rows[0]).toMatchObject({
      key: "bing.com",
      newVisitors: 4,
      returningVisitors: 6,
      total: 10,
      share: 1,
    })
  })
})

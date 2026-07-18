import { describe, expect, it } from "vitest"

import {
  HogQLBinder,
  buildFilterFragments,
  dateRangeFragment,
  preferredContextForDimension,
  whereAnd,
} from "@/lib/posthog/hogql"
import type { AnalyticsFilterClause } from "@/lib/analytics/types"

function clause(
  partial: Omit<AnalyticsFilterClause, "id"> & { id?: string }
): AnalyticsFilterClause {
  return { id: partial.id ?? "c1", ...partial }
}

describe("HogQL filter builders", () => {
  it("binds user values instead of interpolating them into SQL", () => {
    const binder = new HogQLBinder()
    const evil = "'; DROP TABLE events; --"
    const fragment = buildFilterFragments(
      [
        clause({
          dimension: "page",
          operator: "is",
          values: [evil],
        }),
      ],
      "events",
      binder
    )

    expect(fragment.sql).toContain("properties.$pathname")
    expect(fragment.sql).toMatch(/\{page_\d+\}/)
    expect(fragment.sql).not.toContain(evil)
    expect(Object.values(fragment.values)).toContain(evil)
  })

  it("uses native session columns without properties. prefix", () => {
    const binder = new HogQLBinder()
    const fragment = buildFilterFragments(
      [
        clause({
          dimension: "source",
          operator: "is",
          values: ["google"],
        }),
      ],
      "sessions",
      binder
    )
    expect(fragment.sql).toContain("$entry_referring_domain")
    expect(fragment.sql).not.toContain("properties.$entry_referring_domain")
  })

  it("uses IN bindings for multi-value is / is_not", () => {
    const binder = new HogQLBinder()
    const fragment = buildFilterFragments(
      [
        clause({
          dimension: "country",
          operator: "is_not",
          values: ["United States", "Canada"],
        }),
      ],
      "events",
      binder
    )

    expect(fragment.sql).toContain("NOT IN")
    const bound = Object.values(fragment.values)
    expect(bound).toContainEqual(["United States", "Canada"])
  })

  it("builds contains / does_not_contain with ilike bindings", () => {
    const binder = new HogQLBinder()
    const contains = buildFilterFragments(
      [
        clause({
          dimension: "source",
          operator: "contains",
          values: ["google", "bing"],
        }),
      ],
      "events",
      binder
    )
    expect(contains.sql).toContain("ilike")
    expect(contains.sql).toContain(" OR ")
    expect(Object.values(contains.values)).toEqual(
      expect.arrayContaining(["%google%", "%bing%"])
    )

    const binder2 = new HogQLBinder()
    const excludes = buildFilterFragments(
      [
        clause({
          dimension: "source",
          operator: "does_not_contain",
          values: ["spam"],
        }),
      ],
      "events",
      binder2
    )
    expect(excludes.sql).toContain("not ilike")
    expect(Object.values(excludes.values)).toContain("%spam%")
  })

  it("special-cases viewed_page as a session_id subquery with bindings", () => {
    const binder = new HogQLBinder()
    const fragment = buildFilterFragments(
      [
        clause({
          dimension: "viewed_page",
          operator: "is",
          values: ["/pricing"],
        }),
      ],
      "sessions",
      binder
    )

    expect(fragment.sql).toContain("session_id IN")
    expect(fragment.sql).toContain("event = '$pageview'")
    expect(fragment.sql).not.toContain("/pricing")
    expect(Object.values(fragment.values)).toContain("/pricing")
  })

  it("never copies filter property names from user input", () => {
    const binder = new HogQLBinder()
    const fragment = buildFilterFragments(
      [
        clause({
          dimension: "utm_campaign",
          operator: "is",
          values: ["spring"],
        }),
      ],
      "events",
      binder
    )
    expect(fragment.sql).toContain("properties.$utm_campaign")
    expect(fragment.sql).not.toMatch(/properties\.\{/)
  })

  it("date ranges bind from/to values", () => {
    const binder = new HogQLBinder()
    const fragment = dateRangeFragment(
      { from: "2026-01-01", to: "2026-01-31" },
      "timestamp",
      binder
    )
    expect(fragment.sql).toContain("toDate({")
    expect(Object.values(fragment.values)).toEqual(
      expect.arrayContaining(["2026-01-01", "2026-01-31"])
    )
  })

  it("whereAnd defaults to 1 = 1 when empty", () => {
    expect(whereAnd([]).sql).toBe("1 = 1")
  })

  it("prefers session context for entry/exit/channel dimensions", () => {
    expect(preferredContextForDimension("entry_page")).toBe("sessions")
    expect(preferredContextForDimension("exit_page")).toBe("sessions")
    expect(preferredContextForDimension("channel")).toBe("sessions")
    expect(preferredContextForDimension("viewed_page")).toBe("events")
    expect(preferredContextForDimension("page")).toBe("events")
  })
})

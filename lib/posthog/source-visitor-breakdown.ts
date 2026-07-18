/**
 * New and returning visitors by traffic source.
 *
 * NEW_VISITOR_DEFINITION:
 * A pageview counts as "new" when PostHog marks it with
 * `properties.$is_first_session` (true / 'true'). That means the pageview
 * happened during the person's first recorded session for this project.
 * All other pageviews in the selected range count as "returning".
 *
 * This widget counts distinct `person_id` values per (source, visitor type).
 * Source is `properties.$referring_domain` on `$pageview` events (same events
 * expression as the `source` filter). Empty / null domains are labeled
 * "Direct". A person with both a first session and a later session in the
 * range can appear under New and Returning (possibly under different sources).
 */

import type {
  AnalyticsGlobalFilters,
  SourceVisitorBreakdownRow,
} from "@/lib/analytics/types"
import { asNumber, asString } from "@/lib/posthog/client"
import {
  HogQLBinder,
  buildFilterFragments,
  dateRangeFragment,
  whereAnd,
  type HogQLFragment,
} from "@/lib/posthog/hogql"

export const NEW_RETURNING_BY_SOURCE_WIDGET_ID =
  "new_returning_by_source" as const

/** Bound label used when referring domain is empty. */
export const DIRECT_SOURCE_LABEL = "Direct" as const

export const NEW_VISITOR_DEFINITION =
  "A visitor is new when their pageview occurs in their first recorded session (`properties.$is_first_session`). Otherwise they are returning. Counts are distinct people per source and visitor type." as const

const DEFAULT_LIMIT = 50

/**
 * Builds allowlisted HogQL with bound values for the source × visitor-type
 * breakdown. Caller supplies date/filter fragments via `filters`.
 */
export function buildNewReturningBySourceQuery(
  filters: AnalyticsGlobalFilters,
  options?: { limit?: number }
): HogQLFragment {
  const binder = new HogQLBinder()
  const eventKey = binder.next("ev_name")
  const directKey = binder.next("direct_label")
  const limitKey = binder.next("brk_limit")
  const limit = options?.limit ?? DEFAULT_LIMIT

  const pageview: HogQLFragment = {
    sql: `event = {${eventKey}}`,
    values: { [eventKey]: "$pageview" },
  }

  const where = whereAnd([
    dateRangeFragment(filters.dateRange, "timestamp", binder, "ev"),
    buildFilterFragments(filters.clauses, "events", binder),
    pageview,
  ])

  const sourceExpr = `
    if(
      nullIf(toString(properties.$referring_domain), '') IS NULL,
      {${directKey}},
      toString(properties.$referring_domain)
    )
  `.trim()

  const isNewExpr = `
    properties.$is_first_session = true
    OR properties.$is_first_session = 'true'
  `.trim()

  const sql = `
    SELECT
      ${sourceExpr} AS source,
      count(DISTINCT if(${isNewExpr}, person_id, NULL)) AS new_visitors,
      count(DISTINCT if(NOT (${isNewExpr}), person_id, NULL)) AS returning_visitors
    FROM events
    WHERE ${where.sql}
    GROUP BY source
    ORDER BY new_visitors + returning_visitors DESC, source ASC
    LIMIT {${limitKey}}
  `.trim()

  return {
    sql,
    values: {
      ...where.values,
      [directKey]: DIRECT_SOURCE_LABEL,
      [limitKey]: limit,
    },
  }
}

/**
 * Parses HogQL rows shaped as
 * `[source, new_visitors, returning_visitors]`.
 */
export function parseSourceVisitorBreakdownRows(
  results: unknown[]
): SourceVisitorBreakdownRow[] {
  const rows: SourceVisitorBreakdownRow[] = []
  let grandTotal = 0

  for (const row of results) {
    if (!Array.isArray(row)) continue
    const key = asString(row[0]) || DIRECT_SOURCE_LABEL
    const newVisitors = Math.max(0, asNumber(row[1]))
    const returningVisitors = Math.max(0, asNumber(row[2]))
    const total = newVisitors + returningVisitors
    if (total <= 0 && key === "") continue
    grandTotal += total
    rows.push({
      key,
      label: key,
      newVisitors,
      returningVisitors,
      total,
    })
  }

  if (grandTotal > 0) {
    for (const row of rows) {
      row.share = row.total / grandTotal
    }
  }

  return rows
}

export function sourceVisitorBreakdownTotal(
  rows: SourceVisitorBreakdownRow[]
): number {
  return rows.reduce((sum, row) => sum + row.total, 0)
}

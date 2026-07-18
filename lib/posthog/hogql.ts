/**
 * Allowlisted HogQL builders for analytics filters and date windows.
 * Property names and operators are never taken from user input.
 * User values are always passed through PostHog `values` bindings.
 *
 * Events use `properties.$…`. Sessions expose native columns (`$entry_pathname`,
 * `$is_bounce`, etc.) without a `properties.` prefix.
 */

import type {
  AnalyticsDateRange,
  AnalyticsFilterClause,
  AnalyticsFilterDimension,
  AnalyticsFilterOperator,
  AnalyticsGranularity,
} from "@/lib/analytics/types"

export interface HogQLFragment {
  sql: string
  values: Record<string, unknown>
}

type QueryContext = "events" | "sessions"

/** Allowlisted expressions per filter dimension and query context. */
const DIMENSION_EXPR: Record<
  AnalyticsFilterDimension,
  { events: string | null; sessions: string | null }
> = {
  page: {
    events: "properties.$pathname",
    sessions: "$entry_pathname",
  },
  entry_page: {
    events: null,
    sessions: "$entry_pathname",
  },
  exit_page: {
    events: null,
    sessions: "$end_pathname",
  },
  viewed_page: {
    events: "properties.$pathname",
    sessions: null, // special-cased via session_id subquery
  },
  source: {
    events: "properties.$referring_domain",
    sessions: "$entry_referring_domain",
  },
  referrer: {
    events: "properties.$referrer",
    sessions: "$entry_referring_domain",
  },
  channel: {
    events: null,
    sessions: "$channel_type",
  },
  country: {
    events: "properties.$geoip_country_name",
    sessions: "$geoip_country_name",
  },
  region: {
    events: "properties.$geoip_subdivision_1_name",
    sessions: "$geoip_subdivision_1_name",
  },
  city: {
    events: "properties.$geoip_city_name",
    sessions: "$geoip_city_name",
  },
  device: {
    events: "properties.$device_type",
    sessions: "$device_type",
  },
  browser: {
    events: "properties.$browser",
    sessions: "$browser",
  },
  os: {
    events: "properties.$os",
    sessions: "$os",
  },
  screen_size: {
    events:
      "concat(toString(properties.$screen_width), 'x', toString(properties.$screen_height))",
    sessions:
      "concat(toString($viewport_width), 'x', toString($viewport_height))",
  },
  language: {
    events: "properties.$browser_language",
    sessions: "$entry_browser_language",
  },
  utm_source: {
    events: "properties.$utm_source",
    sessions: "$entry_utm_source",
  },
  utm_medium: {
    events: "properties.$utm_medium",
    sessions: "$entry_utm_medium",
  },
  utm_campaign: {
    events: "properties.$utm_campaign",
    sessions: "$entry_utm_campaign",
  },
  utm_content: {
    events: "properties.$utm_content",
    sessions: "$entry_utm_content",
  },
  utm_term: {
    events: "properties.$utm_term",
    sessions: "$entry_utm_term",
  },
  goal: {
    events: "event",
    sessions: null,
  },
  event: {
    events: "event",
    sessions: null,
  },
}

/** Per-request binder so concurrent queries never collide on placeholder names. */
export class HogQLBinder {
  private counter = 0

  next(prefix: string): string {
    this.counter += 1
    return `${prefix}_${this.counter}`
  }
}

export function mergeFragments(parts: HogQLFragment[]): HogQLFragment {
  const values: Record<string, unknown> = {}
  const sqlParts: string[] = []
  for (const part of parts) {
    if (!part.sql.trim()) continue
    sqlParts.push(part.sql)
    Object.assign(values, part.values)
  }
  return {
    sql: sqlParts.join(" AND "),
    values,
  }
}

export function dateRangeFragment(
  range: AnalyticsDateRange,
  column: "timestamp" | "$start_timestamp" = "timestamp",
  binder: HogQLBinder,
  prefix = "dr"
): HogQLFragment {
  const fromKey = binder.next(`${prefix}_from`)
  const toKey = binder.next(`${prefix}_to`)
  return {
    sql: `toDate(${column}) >= toDate({${fromKey}}) AND toDate(${column}) <= toDate({${toKey}})`,
    values: {
      [fromKey]: range.from,
      [toKey]: range.to,
    },
  }
}

function matchOperator(
  expr: string,
  operator: AnalyticsFilterOperator,
  values: string[],
  binder: HogQLBinder,
  prefix: string
): HogQLFragment {
  const bindings: Record<string, unknown> = {}

  if (operator === "is" || operator === "is_not") {
    if (values.length === 1) {
      const key = binder.next(prefix)
      bindings[key] = values[0]
      const cmp =
        operator === "is" ? `${expr} = {${key}}` : `notEquals(${expr}, {${key}})`
      return { sql: `(${cmp})`, values: bindings }
    }
    const key = binder.next(prefix)
    bindings[key] = values
    const cmp =
      operator === "is" ? `${expr} IN {${key}}` : `${expr} NOT IN {${key}}`
    return { sql: `(${cmp})`, values: bindings }
  }

  const likes = values.map((value) => {
    const key = binder.next(prefix)
    bindings[key] = `%${value}%`
    return `ilike(toString(${expr}), {${key}})`
  })

  if (operator === "contains") {
    return { sql: `(${likes.join(" OR ")})`, values: bindings }
  }

  const negated = likes.map((part) => `not ${part}`)
  return { sql: `(${negated.join(" AND ")})`, values: bindings }
}

function viewedPageSessionFragment(
  clause: AnalyticsFilterClause,
  binder: HogQLBinder
): HogQLFragment {
  const pathMatch = matchOperator(
    "properties.$pathname",
    clause.operator,
    clause.values,
    binder,
    "vp"
  )
  return {
    sql: `session_id IN (
      SELECT DISTINCT properties.$session_id
      FROM events
      WHERE event = '$pageview'
        AND properties.$session_id IS NOT NULL
        AND ${pathMatch.sql}
    )`,
    values: pathMatch.values,
  }
}

/**
 * Build AND-combined WHERE fragments for filter clauses.
 * Skips clauses that cannot apply in the given context.
 */
export function buildFilterFragments(
  clauses: AnalyticsFilterClause[],
  context: QueryContext,
  binder: HogQLBinder
): HogQLFragment {
  const parts: HogQLFragment[] = []

  for (const clause of clauses) {
    if (clause.dimension === "viewed_page" && context === "sessions") {
      parts.push(viewedPageSessionFragment(clause, binder))
      continue
    }

    const mapping = DIMENSION_EXPR[clause.dimension]
    const expr = mapping[context]
    if (!expr) continue

    parts.push(
      matchOperator(
        expr,
        clause.operator,
        clause.values,
        binder,
        clause.dimension
      )
    )
  }

  return mergeFragments(parts)
}

export function granularityBucketExpr(
  granularity: AnalyticsGranularity,
  column = "timestamp"
): string {
  switch (granularity) {
    case "hour":
      return `toStartOfHour(${column})`
    case "week":
      return `toStartOfWeek(${column})`
    case "month":
      return `toStartOfMonth(${column})`
    case "day":
    default:
      return `toStartOfDay(${column})`
  }
}

export function whereAnd(fragments: HogQLFragment[]): HogQLFragment {
  const merged = mergeFragments(fragments)
  if (!merged.sql.trim()) {
    return { sql: "1 = 1", values: {} }
  }
  return merged
}

/** Dimension expression for filter-options / breakdown queries. */
export function dimensionExpression(
  dimension: AnalyticsFilterDimension,
  context: QueryContext
): string | null {
  if (dimension === "viewed_page") {
    return context === "events" ? "properties.$pathname" : null
  }
  return DIMENSION_EXPR[dimension][context]
}

/** Prefer sessions for dimensions that are session-native. */
export function preferredContextForDimension(
  dimension: AnalyticsFilterDimension
): QueryContext {
  const sessionsExpr = DIMENSION_EXPR[dimension].sessions
  const eventsExpr = DIMENSION_EXPR[dimension].events
  if (dimension === "viewed_page") return "events"
  if (sessionsExpr && !eventsExpr) return "sessions"
  if (
    dimension === "entry_page" ||
    dimension === "exit_page" ||
    dimension === "channel"
  ) {
    return "sessions"
  }
  if (eventsExpr) return "events"
  return "sessions"
}

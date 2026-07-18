/**
 * Per-widget HogQL runners. Allowlisted SQL only; filters via hogql builders.
 */

import type {
  AnalyticsErrorCode,
  AnalyticsFilterDimension,
  AnalyticsGlobalFilters,
  AnalyticsWidgetId,
  MetricComparison,
  RankedRow,
  TimeSeriesPoint,
  WidgetResultEntry,
  WidgetResultPayload,
} from "@/lib/analytics/types"
import { userFacingAnalyticsMessage } from "@/lib/analytics/user-facing"
import type { PostHogCredentials } from "@/lib/posthog/config"
import {
  asNumber,
  asString,
  changeRatio,
  runHogQL,
} from "@/lib/posthog/client"
import {
  HogQLBinder,
  buildFilterFragments,
  dateRangeFragment,
  dimensionExpression,
  granularityBucketExpr,
  preferredContextForDimension,
  whereAnd,
  type HogQLFragment,
} from "@/lib/posthog/hogql"
import {
  NEW_RETURNING_BY_SOURCE_WIDGET_ID,
  buildNewReturningBySourceQuery,
  parseSourceVisitorBreakdownRows,
  sourceVisitorBreakdownTotal,
} from "@/lib/posthog/source-visitor-breakdown"

const TABLE_LIMIT = 50

/** Widgets that need custom events / autocapture not assumed present. */
const NEEDS_TRACKING: Partial<Record<AnalyticsWidgetId, string>> = {
  scroll_depth: "Scroll depth events are not configured for this project yet.",
  outbound_links: "Outbound link click tracking is not configured yet.",
  downloads: "File download tracking is not configured yet.",
  site_search: "Site search events are not configured yet.",
  page_paths: "Path analysis requires additional session path tracking.",
  page_transitions: "Page transition tracking is not configured yet.",
  engaged_visits: "Engaged-visit definitions are not configured yet.",
  visit_frequency: "Visit frequency cohorts are not configured yet.",
  retention: "Retention cohorts are not enabled for this dashboard yet.",
  time_on_page: "Time-on-page requires custom timing events.",
  campaigns: "Campaign grouping needs consistent UTM campaign tagging.",
  landing_pages_by_source:
    "Landing page by source needs combined session and source tagging.",
  paid_vs_organic: "Paid vs organic needs channel classification rules.",
  timezones: "Visitor timezone capture is not configured yet.",
  browser_versions: "Browser version breakdown is not enabled yet.",
  os_versions: "OS version breakdown is not enabled yet.",
  goal_completions: "Define goals or conversion events before tracking completions.",
  conversion_rate: "Define conversion goals before measuring rate.",
  conversion_trend: "Define conversion goals before measuring trend.",
  funnels: "Funnels require a configured multi-step conversion path.",
  form_submissions: "Form submission events are not configured yet.",
  revenue: "Revenue properties are not captured on events yet.",
  core_web_vitals: "Web vitals events are not being captured yet.",
  slow_pages: "Performance timing events are not being captured yet.",
  errors_404: "404 / error page tracking is not configured yet.",
}

type WidgetRunner = (
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
) => Promise<WidgetResultEntry>

function fail(
  widgetId: AnalyticsWidgetId,
  code: AnalyticsErrorCode,
  message: string
): WidgetResultEntry {
  return {
    widgetId,
    ok: false,
    error: {
      widgetId,
      code,
      message: userFacingAnalyticsMessage(message),
    },
  }
}

function ok(
  widgetId: AnalyticsWidgetId,
  data: WidgetResultPayload,
  helpIds?: string[]
): WidgetResultEntry {
  return { widgetId, ok: true, data, helpIds }
}

function empty(widgetId: AnalyticsWidgetId, reason: string): WidgetResultEntry {
  return ok(widgetId, { kind: "empty", reason })
}

function eventsWhere(
  filters: AnalyticsGlobalFilters,
  binder: HogQLBinder,
  range = filters.dateRange,
  extra?: HogQLFragment
): HogQLFragment {
  return whereAnd([
    dateRangeFragment(range, "timestamp", binder, "ev"),
    buildFilterFragments(filters.clauses, "events", binder),
    ...(extra ? [extra] : []),
  ])
}

function sessionsWhere(
  filters: AnalyticsGlobalFilters,
  binder: HogQLBinder,
  range = filters.dateRange,
  extra?: HogQLFragment
): HogQLFragment {
  return whereAnd([
    dateRangeFragment(range, "$start_timestamp", binder, "sess"),
    buildFilterFragments(filters.clauses, "sessions", binder),
    ...(extra ? [extra] : []),
  ])
}

async function queryRows(
  credentials: PostHogCredentials,
  name: string,
  sql: string,
  values: Record<string, unknown>,
  signal?: AbortSignal
): Promise<
  | { ok: true; results: unknown[] }
  | { ok: false; code: AnalyticsErrorCode; message: string }
> {
  const result = await runHogQL(credentials, {
    query: sql,
    values,
    name,
    refresh: "blocking",
    signal,
  })
  if (!result.ok) {
    const detail = result.detail?.trim()
    const combined =
      detail && detail.length > 0
        ? `${result.message} ${detail.slice(0, 240)}`
        : result.message
    return {
      ok: false,
      code: result.code,
      message: userFacingAnalyticsMessage(combined),
    }
  }
  return { ok: true, results: result.results }
}

function metricComparison(
  current: number,
  previous: number | null
): MetricComparison {
  return {
    current,
    previous,
    changeRatio: changeRatio(current, previous),
  }
}

function firstCell(results: unknown[]): unknown {
  const row = results[0]
  return Array.isArray(row) ? row[0] : row
}

async function kpiFromSessions(
  credentials: PostHogCredentials,
  widgetId: AnalyticsWidgetId,
  filters: AnalyticsGlobalFilters,
  selectExpr: string,
  unit: "count" | "percent" | "duration_seconds",
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const binder = new HogQLBinder()
  const currentWhere = sessionsWhere(filters, binder)
  const current = await queryRows(
    credentials,
    `ampere_${widgetId}_current`,
    `SELECT ${selectExpr} AS value FROM sessions WHERE ${currentWhere.sql}`,
    currentWhere.values,
    signal
  )
  if (!current.ok) return fail(widgetId, current.code, current.message)

  const currentValue = asNumber(firstCell(current.results))

  let previousValue: number | null = null
  if (filters.comparisonRange) {
    const prevBinder = new HogQLBinder()
    const prevWhere = sessionsWhere(filters, prevBinder, filters.comparisonRange)
    const prev = await queryRows(
      credentials,
      `ampere_${widgetId}_prev`,
      `SELECT ${selectExpr} AS value FROM sessions WHERE ${prevWhere.sql}`,
      prevWhere.values,
      signal
    )
    if (prev.ok) previousValue = asNumber(firstCell(prev.results))
  }

  return ok(widgetId, {
    kind: "kpi",
    metric: metricComparison(currentValue, previousValue),
    unit,
  })
}

async function kpiFromEvents(
  credentials: PostHogCredentials,
  widgetId: AnalyticsWidgetId,
  filters: AnalyticsGlobalFilters,
  selectExpr: string,
  eventName: string,
  unit: "count" | "percent" | "duration_seconds",
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const binder = new HogQLBinder()
  const eventKey = binder.next("ev_name")
  const pageview = {
    sql: `event = {${eventKey}}`,
    values: { [eventKey]: eventName },
  }
  const currentWhere = eventsWhere(filters, binder, filters.dateRange, pageview)
  const current = await queryRows(
    credentials,
    `ampere_${widgetId}_current`,
    `SELECT ${selectExpr} AS value FROM events WHERE ${currentWhere.sql}`,
    currentWhere.values,
    signal
  )
  if (!current.ok) return fail(widgetId, current.code, current.message)

  const currentValue = asNumber(firstCell(current.results))

  let previousValue: number | null = null
  if (filters.comparisonRange) {
    const prevBinder = new HogQLBinder()
    const prevEventKey = prevBinder.next("ev_name")
    const prevPageview = {
      sql: `event = {${prevEventKey}}`,
      values: { [prevEventKey]: eventName },
    }
    const prevWhere = eventsWhere(
      filters,
      prevBinder,
      filters.comparisonRange,
      prevPageview
    )
    const prev = await queryRows(
      credentials,
      `ampere_${widgetId}_prev`,
      `SELECT ${selectExpr} AS value FROM events WHERE ${prevWhere.sql}`,
      prevWhere.values,
      signal
    )
    if (prev.ok) previousValue = asNumber(firstCell(prev.results))
  }

  return ok(widgetId, {
    kind: "kpi",
    metric: metricComparison(currentValue, previousValue),
    unit,
  })
}

async function visitorsOverTime(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const widgetId = "visitors_over_time" as const
  const bucket = granularityBucketExpr(filters.granularity, "timestamp")
  const binder = new HogQLBinder()
  const eventKey = binder.next("ev_name")
  const pageview = {
    sql: `event = {${eventKey}}`,
    values: { [eventKey]: "$pageview" },
  }
  const currentWhere = eventsWhere(filters, binder, filters.dateRange, pageview)
  const current = await queryRows(
    credentials,
    "ampere_visitors_over_time",
    `
      SELECT ${bucket} AS t, count(DISTINCT person_id) AS value
      FROM events
      WHERE ${currentWhere.sql}
      GROUP BY t
      ORDER BY t ASC
      LIMIT 500
    `,
    currentWhere.values,
    signal
  )
  if (!current.ok) return fail(widgetId, current.code, current.message)

  const byTime = new Map<string, TimeSeriesPoint>()
  for (const row of current.results) {
    if (!Array.isArray(row)) continue
    const t = asString(row[0])
    byTime.set(t, { t, value: asNumber(row[1]), previousValue: null })
  }

  if (filters.comparisonRange) {
    const prevBinder = new HogQLBinder()
    const prevEventKey = prevBinder.next("ev_name")
    const prevPageview = {
      sql: `event = {${prevEventKey}}`,
      values: { [prevEventKey]: "$pageview" },
    }
    const prevWhere = eventsWhere(
      filters,
      prevBinder,
      filters.comparisonRange,
      prevPageview
    )
    const prev = await queryRows(
      credentials,
      "ampere_visitors_over_time_prev",
      `
        SELECT ${bucket} AS t, count(DISTINCT person_id) AS value
        FROM events
        WHERE ${prevWhere.sql}
        GROUP BY t
        ORDER BY t ASC
        LIMIT 500
      `,
      prevWhere.values,
      signal
    )
    if (prev.ok) {
      const prevPoints = prev.results
        .filter(Array.isArray)
        .map((row) => ({ t: asString(row[0]), value: asNumber(row[1]) }))
      const currentKeys = [...byTime.keys()].sort()
      prevPoints.forEach((point, index) => {
        const key = currentKeys[index]
        if (!key) return
        const existing = byTime.get(key)
        if (existing) existing.previousValue = point.value
      })
    }
  }

  return ok(widgetId, {
    kind: "timeseries",
    series: [...byTime.values()],
    unit: "count",
  })
}

async function rankedBreakdown(
  credentials: PostHogCredentials,
  widgetId: AnalyticsWidgetId,
  filters: AnalyticsGlobalFilters,
  options: {
    context: "events" | "sessions"
    expr: string
    eventName?: string
    limit?: number
  },
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const limit = options.limit ?? TABLE_LIMIT
  const binder = new HogQLBinder()
  const limitKey = binder.next("brk_limit")

  if (options.context === "events") {
    const eventKey = binder.next("ev_name")
    const extra = {
      sql: `event = {${eventKey}}`,
      values: { [eventKey]: options.eventName ?? "$pageview" },
    }
    const where = eventsWhere(filters, binder, filters.dateRange, extra)
    const result = await queryRows(
      credentials,
      `ampere_${widgetId}`,
      `
        SELECT ${options.expr} AS key, count() AS value
        FROM events
        WHERE ${where.sql}
          AND ${options.expr} IS NOT NULL
          AND toString(${options.expr}) != ''
        GROUP BY key
        ORDER BY value DESC
        LIMIT {${limitKey}}
      `,
      { ...where.values, [limitKey]: limit },
      signal
    )
    if (!result.ok) return fail(widgetId, result.code, result.message)
    return ok(widgetId, {
      kind: "table",
      rows: toRankedRows(result.results),
      total: sumValues(result.results),
    })
  }

  const where = sessionsWhere(filters, binder)
  const result = await queryRows(
    credentials,
    `ampere_${widgetId}`,
    `
      SELECT ${options.expr} AS key, count() AS value
      FROM sessions
      WHERE ${where.sql}
        AND ${options.expr} IS NOT NULL
        AND toString(${options.expr}) != ''
      GROUP BY key
      ORDER BY value DESC
      LIMIT {${limitKey}}
    `,
    { ...where.values, [limitKey]: limit },
    signal
  )
  if (!result.ok) return fail(widgetId, result.code, result.message)
  return ok(widgetId, {
    kind: "table",
    rows: toRankedRows(result.results),
    total: sumValues(result.results),
  })
}

function toRankedRows(results: unknown[]): RankedRow[] {
  const rows: RankedRow[] = []
  let total = 0
  for (const row of results) {
    if (!Array.isArray(row)) continue
    const value = asNumber(row[1])
    total += value
    const key = asString(row[0]) || "(none)"
    rows.push({ key, label: key, value })
  }
  if (total > 0) {
    for (const row of rows) {
      row.share = row.value / total
    }
  }
  return rows
}

function sumValues(results: unknown[]): number {
  let total = 0
  for (const row of results) {
    if (!Array.isArray(row)) continue
    total += asNumber(row[1])
  }
  return total
}

async function newVsReturning(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const widgetId = "new_vs_returning" as const
  const binder = new HogQLBinder()
  const eventKey = binder.next("ev_name")
  const where = eventsWhere(filters, binder, filters.dateRange, {
    sql: `event = {${eventKey}}`,
    values: { [eventKey]: "$pageview" },
  })
  const result = await queryRows(
    credentials,
    "ampere_new_vs_returning",
    `
      SELECT
        if(
          properties.$is_first_session = true OR properties.$is_first_session = 'true',
          'New',
          'Returning'
        ) AS key,
        count(DISTINCT person_id) AS value
      FROM events
      WHERE ${where.sql}
      GROUP BY key
      ORDER BY value DESC
      LIMIT 10
    `,
    where.values,
    signal
  )
  if (!result.ok) return fail(widgetId, result.code, result.message)
  return ok(widgetId, {
    kind: "table",
    rows: toRankedRows(result.results),
    total: sumValues(result.results),
  })
}

async function timeOfDay(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const widgetId = "time_of_day" as const
  const binder = new HogQLBinder()
  const eventKey = binder.next("ev_name")
  const where = eventsWhere(filters, binder, filters.dateRange, {
    sql: `event = {${eventKey}}`,
    values: { [eventKey]: "$pageview" },
  })
  const result = await queryRows(
    credentials,
    "ampere_time_of_day",
    `
      SELECT toHour(timestamp) AS key, count(DISTINCT person_id) AS value
      FROM events
      WHERE ${where.sql}
      GROUP BY key
      ORDER BY key ASC
      LIMIT 24
    `,
    where.values,
    signal
  )
  if (!result.ok) return fail(widgetId, result.code, result.message)
  return ok(widgetId, {
    kind: "table",
    rows: toRankedRows(result.results).map((row) => ({
      ...row,
      label: `${row.key}:00`,
    })),
    total: sumValues(result.results),
  })
}

async function dayOfWeek(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const widgetId = "day_of_week" as const
  const binder = new HogQLBinder()
  const eventKey = binder.next("ev_name")
  const where = eventsWhere(filters, binder, filters.dateRange, {
    sql: `event = {${eventKey}}`,
    values: { [eventKey]: "$pageview" },
  })
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const result = await queryRows(
    credentials,
    "ampere_day_of_week",
    `
      SELECT toDayOfWeek(timestamp) AS key, count(DISTINCT person_id) AS value
      FROM events
      WHERE ${where.sql}
      GROUP BY key
      ORDER BY key ASC
      LIMIT 7
    `,
    where.values,
    signal
  )
  if (!result.ok) return fail(widgetId, result.code, result.message)
  return ok(widgetId, {
    kind: "table",
    rows: toRankedRows(result.results).map((row) => {
      const idx = Number(row.key)
      return { ...row, label: labels[idx] ?? row.key }
    }),
    total: sumValues(result.results),
  })
}

async function customEvents(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const widgetId = "custom_events" as const
  const binder = new HogQLBinder()
  const where = eventsWhere(filters, binder)
  const limitKey = binder.next("brk_limit")
  const result = await queryRows(
    credentials,
    "ampere_custom_events",
    `
      SELECT event AS key, count() AS value
      FROM events
      WHERE ${where.sql}
        AND event NOT IN (
          '$pageview', '$pageleave', '$identify', '$groupidentify', '$set', '$autocapture'
        )
      GROUP BY key
      ORDER BY value DESC
      LIMIT {${limitKey}}
    `,
    { ...where.values, [limitKey]: TABLE_LIMIT },
    signal
  )
  if (!result.ok) return fail(widgetId, result.code, result.message)
  return ok(widgetId, {
    kind: "table",
    rows: toRankedRows(result.results),
    total: sumValues(result.results),
  })
}

async function newReturningBySource(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const widgetId = NEW_RETURNING_BY_SOURCE_WIDGET_ID
  const query = buildNewReturningBySourceQuery(filters, { limit: TABLE_LIMIT })
  const result = await queryRows(
    credentials,
    "ampere_new_returning_by_source",
    query.sql,
    query.values,
    signal
  )
  if (!result.ok) return fail(widgetId, result.code, result.message)

  const rows = parseSourceVisitorBreakdownRows(result.results)
  if (rows.length === 0) {
    return empty(widgetId, "No visitor source data for this period.")
  }

  return ok(
    widgetId,
    {
      kind: "source_visitor_breakdown",
      rows,
      total: sourceVisitorBreakdownTotal(rows),
    },
    ["visitors", "new_vs_returning", "traffic_sources"]
  )
}

async function geoMap(
  credentials: PostHogCredentials,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const table = await rankedBreakdown(
    credentials,
    "countries",
    filters,
    {
      context: "events",
      expr: "properties.$geoip_country_code",
    },
    signal
  )
  if (!table.ok) return { ...table, widgetId: "geo_map", error: { ...table.error, widgetId: "geo_map" } }
  if (table.data.kind !== "table") {
    return empty("geo_map", "No country data available.")
  }
  return ok("geo_map", { kind: "map", rows: table.data.rows })
}

const RUNNERS: Partial<Record<AnalyticsWidgetId, WidgetRunner>> = {
  visitors: (c, f, s) =>
    kpiFromEvents(
      c,
      "visitors",
      f,
      "count(DISTINCT person_id)",
      "$pageview",
      "count",
      s
    ),
  pageviews: (c, f, s) =>
    kpiFromEvents(c, "pageviews", f, "count()", "$pageview", "count", s),
  bounce_rate: (c, f, s) =>
    kpiFromSessions(
      c,
      "bounce_rate",
      f,
      "if(count() = 0, 0, avg($is_bounce) * 100.0)",
      "percent",
      s
    ),
  visitors_over_time: (c, f, s) => visitorsOverTime(c, f, s),
  top_pages: (c, f, s) =>
    rankedBreakdown(
      c,
      "top_pages",
      f,
      { context: "events", expr: "properties.$pathname" },
      s
    ),
  traffic_sources: (c, f, s) =>
    rankedBreakdown(
      c,
      "traffic_sources",
      f,
      { context: "sessions", expr: "$entry_referring_domain" },
      s
    ),
  sessions: (c, f, s) =>
    kpiFromSessions(c, "sessions", f, "count()", "count", s),
  session_duration: (c, f, s) =>
    kpiFromSessions(
      c,
      "session_duration",
      f,
      "avg($session_duration)",
      "duration_seconds",
      s
    ),
  pages_per_session: (c, f, s) =>
    kpiFromSessions(
      c,
      "pages_per_session",
      f,
      "avg($pageview_count)",
      "count",
      s
    ),
  new_vs_returning: (c, f, s) => newVsReturning(c, f, s),
  time_of_day: (c, f, s) => timeOfDay(c, f, s),
  day_of_week: (c, f, s) => dayOfWeek(c, f, s),
  entry_pages: (c, f, s) =>
    rankedBreakdown(
      c,
      "entry_pages",
      f,
      { context: "sessions", expr: "$entry_pathname" },
      s
    ),
  exit_pages: (c, f, s) =>
    rankedBreakdown(
      c,
      "exit_pages",
      f,
      { context: "sessions", expr: "$end_pathname" },
      s
    ),
  referrers: (c, f, s) =>
    rankedBreakdown(
      c,
      "referrers",
      f,
      { context: "events", expr: "properties.$referrer" },
      s
    ),
  channels: (c, f, s) =>
    rankedBreakdown(
      c,
      "channels",
      f,
      { context: "sessions", expr: "$channel_type" },
      s
    ),
  utm_source: (c, f, s) =>
    rankedBreakdown(
      c,
      "utm_source",
      f,
      { context: "events", expr: "properties.$utm_source" },
      s
    ),
  utm_medium: (c, f, s) =>
    rankedBreakdown(
      c,
      "utm_medium",
      f,
      { context: "events", expr: "properties.$utm_medium" },
      s
    ),
  utm_campaign: (c, f, s) =>
    rankedBreakdown(
      c,
      "utm_campaign",
      f,
      { context: "events", expr: "properties.$utm_campaign" },
      s
    ),
  utm_content: (c, f, s) =>
    rankedBreakdown(
      c,
      "utm_content",
      f,
      { context: "events", expr: "properties.$utm_content" },
      s
    ),
  utm_term: (c, f, s) =>
    rankedBreakdown(
      c,
      "utm_term",
      f,
      { context: "events", expr: "properties.$utm_term" },
      s
    ),
  new_returning_by_source: (c, f, s) => newReturningBySource(c, f, s),
  countries: (c, f, s) =>
    rankedBreakdown(
      c,
      "countries",
      f,
      { context: "events", expr: "properties.$geoip_country_name" },
      s
    ),
  regions: (c, f, s) =>
    rankedBreakdown(
      c,
      "regions",
      f,
      { context: "events", expr: "properties.$geoip_subdivision_1_name" },
      s
    ),
  cities: (c, f, s) =>
    rankedBreakdown(
      c,
      "cities",
      f,
      { context: "events", expr: "properties.$geoip_city_name" },
      s
    ),
  languages: (c, f, s) =>
    rankedBreakdown(
      c,
      "languages",
      f,
      { context: "events", expr: "properties.$browser_language" },
      s
    ),
  geo_map: (c, f, s) => geoMap(c, f, s),
  devices: (c, f, s) =>
    rankedBreakdown(
      c,
      "devices",
      f,
      { context: "events", expr: "properties.$device_type" },
      s
    ),
  browsers: (c, f, s) =>
    rankedBreakdown(
      c,
      "browsers",
      f,
      { context: "events", expr: "properties.$browser" },
      s
    ),
  operating_systems: (c, f, s) =>
    rankedBreakdown(
      c,
      "operating_systems",
      f,
      { context: "events", expr: "properties.$os" },
      s
    ),
  screen_sizes: (c, f, s) =>
    rankedBreakdown(
      c,
      "screen_sizes",
      f,
      {
        context: "events",
        expr: "concat(toString(properties.$screen_width), 'x', toString(properties.$screen_height))",
      },
      s
    ),
  custom_events: (c, f, s) => customEvents(c, f, s),
  active_visitors: async (c, _f, s) => {
    const live = await fetchLivePayload(c, s)
    if (!live.ok) return fail("active_visitors", live.code, live.message)
    return ok("active_visitors", {
      kind: "kpi",
      metric: metricComparison(live.activeVisitors, null),
      unit: "count",
    })
  },
  active_pages: async (c, _f, s) => {
    const live = await fetchLivePayload(c, s)
    if (!live.ok) return fail("active_pages", live.code, live.message)
    return ok("active_pages", { kind: "table", rows: live.activePages })
  },
  live_sources: async (c, _f, s) => {
    const live = await fetchLivePayload(c, s)
    if (!live.ok) return fail("live_sources", live.code, live.message)
    return ok("live_sources", { kind: "table", rows: live.liveSources })
  },
}

export interface LivePayload {
  ok: true
  activeVisitors: number
  activePages: RankedRow[]
  liveSources: RankedRow[]
}

export interface LivePayloadFailure {
  ok: false
  code: AnalyticsErrorCode
  message: string
}

export async function fetchLivePayload(
  credentials: PostHogCredentials,
  signal?: AbortSignal
): Promise<LivePayload | LivePayloadFailure> {
  const visitorsSql = `
    SELECT count(DISTINCT person_id) AS value
    FROM events
    WHERE timestamp >= now() - INTERVAL 5 MINUTE
      AND event = '$pageview'
  `
  const pagesSql = `
    SELECT properties.$pathname AS key, count(DISTINCT person_id) AS value
    FROM events
    WHERE timestamp >= now() - INTERVAL 5 MINUTE
      AND event = '$pageview'
      AND properties.$pathname IS NOT NULL
    GROUP BY key
    ORDER BY value DESC
    LIMIT 20
  `
  const sourcesSql = `
    SELECT properties.$referring_domain AS key, count(DISTINCT person_id) AS value
    FROM events
    WHERE timestamp >= now() - INTERVAL 5 MINUTE
      AND event = '$pageview'
      AND properties.$referring_domain IS NOT NULL
      AND toString(properties.$referring_domain) != ''
    GROUP BY key
    ORDER BY value DESC
    LIMIT 20
  `

  const [visitors, pages, sources] = await Promise.all([
    queryRows(credentials, "ampere_live_visitors", visitorsSql, {}, signal),
    queryRows(credentials, "ampere_live_pages", pagesSql, {}, signal),
    queryRows(credentials, "ampere_live_sources", sourcesSql, {}, signal),
  ])

  if (!visitors.ok) {
    return { ok: false, code: visitors.code, message: visitors.message }
  }
  if (!pages.ok) return { ok: false, code: pages.code, message: pages.message }
  if (!sources.ok) {
    return { ok: false, code: sources.code, message: sources.message }
  }

  return {
    ok: true,
    activeVisitors: asNumber(firstCell(visitors.results)),
    activePages: toRankedRows(pages.results),
    liveSources: toRankedRows(sources.results),
  }
}

export async function runWidgetQuery(
  credentials: PostHogCredentials,
  widgetId: AnalyticsWidgetId,
  filters: AnalyticsGlobalFilters,
  signal?: AbortSignal
): Promise<WidgetResultEntry> {
  const needsTracking = NEEDS_TRACKING[widgetId]
  if (needsTracking) {
    return empty(widgetId, needsTracking)
  }

  const runner = RUNNERS[widgetId]
  if (!runner) {
    return empty(widgetId, "This widget is not available for querying yet.")
  }

  try {
    return await runner(credentials, filters, signal)
  } catch (err) {
    return fail(
      widgetId,
      "query_failed",
      err instanceof Error ? err.message : "Widget query failed."
    )
  }
}

export async function runFilterOptionsQuery(
  credentials: PostHogCredentials,
  dimension: AnalyticsFilterDimension,
  filters: AnalyticsGlobalFilters,
  search: string | undefined,
  limit: number,
  signal?: AbortSignal
): Promise<
  | { ok: true; options: { value: string; label: string; count?: number }[] }
  | { ok: false; code: AnalyticsErrorCode; message: string }
> {
  const context = preferredContextForDimension(dimension)
  const expr = dimensionExpression(dimension, context)
  if (!expr) {
    return { ok: true, options: [] }
  }

  const binder = new HogQLBinder()
  const limitKey = binder.next("fo_limit")

  const searchFrag: HogQLFragment | undefined = search?.trim()
    ? (() => {
        const key = binder.next("fo_search")
        return {
          sql: `ilike(toString(${expr}), {${key}})`,
          values: { [key]: `%${search.trim()}%` },
        }
      })()
    : undefined

  const otherClauses = filters.clauses.filter((c) => c.dimension !== dimension)

  if (context === "sessions") {
    const where = whereAnd([
      dateRangeFragment(filters.dateRange, "$start_timestamp", binder, "fo"),
      buildFilterFragments(otherClauses, "sessions", binder),
      ...(searchFrag ? [searchFrag] : []),
    ])
    const result = await queryRows(
      credentials,
      `ampere_filter_options_${dimension}`,
      `
        SELECT ${expr} AS value, count() AS count
        FROM sessions
        WHERE ${where.sql}
          AND ${expr} IS NOT NULL
          AND toString(${expr}) != ''
        GROUP BY value
        ORDER BY count DESC
        LIMIT {${limitKey}}
      `,
      { ...where.values, [limitKey]: limit },
      signal
    )
    if (!result.ok) return result
    return {
      ok: true,
      options: result.results.filter(Array.isArray).map((row) => {
        const value = asString(row[0])
        return { value, label: value, count: asNumber(row[1]) }
      }),
    }
  }

  const where = whereAnd([
    dateRangeFragment(filters.dateRange, "timestamp", binder, "fo"),
    buildFilterFragments(otherClauses, "events", binder),
    ...(searchFrag ? [searchFrag] : []),
  ])
  const result = await queryRows(
    credentials,
    `ampere_filter_options_${dimension}`,
    `
      SELECT ${expr} AS value, count() AS count
      FROM events
      WHERE ${where.sql}
        AND ${expr} IS NOT NULL
        AND toString(${expr}) != ''
      GROUP BY value
      ORDER BY count DESC
      LIMIT {${limitKey}}
    `,
    { ...where.values, [limitKey]: limit },
    signal
  )
  if (!result.ok) return result
  return {
    ok: true,
    options: result.results.filter(Array.isArray).map((row) => {
      const value = asString(row[0])
      return { value, label: value, count: asNumber(row[1]) }
    }),
  }
}

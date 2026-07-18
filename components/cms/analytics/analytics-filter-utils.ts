/**
 * Filter state utilities for the analytics dashboard.
 * Handles default state, URL serialization/deserialization, and filter mutations.
 */
import type {
  AnalyticsFilterClause,
  AnalyticsFilterDimension,
  AnalyticsFilterOperator,
  AnalyticsGlobalFilters,
  AnalyticsGranularity,
} from "@/lib/analytics/types"

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Compute the equal previous period for a date range. */
export function getPrevPeriod(
  from: string,
  to: string
): { from: string; to: string } | null {
  try {
    const f = new Date(from)
    const t = new Date(to + "T23:59:59Z")
    const durationMs = t.getTime() - f.getTime()
    const prevTo = new Date(f.getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - durationMs)
    return {
      from: prevFrom.toISOString().slice(0, 10),
      to: prevTo.toISOString().slice(0, 10),
    }
  } catch {
    return null
  }
}

/** Pick a sensible granularity for a given date range. */
export function autoGranularity(from: string, to: string): AnalyticsGranularity {
  const diffDays =
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 1) return "hour"
  if (diffDays <= 60) return "day"
  if (diffDays <= 180) return "week"
  return "month"
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export type DatePreset = "1d" | "7d" | "30d" | "90d" | "6m" | "12m" | "custom"

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  "1d": "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last year",
  custom: "Custom range",
}

export function presetRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date()
  const to = toISODate(today)
  const from = new Date(today)

  switch (preset) {
    case "1d":
      return { from: to, to }
    case "7d":
      from.setDate(today.getDate() - 6)
      break
    case "30d":
      from.setDate(today.getDate() - 29)
      break
    case "90d":
      from.setDate(today.getDate() - 89)
      break
    case "6m":
      from.setMonth(today.getMonth() - 6)
      break
    case "12m":
      from.setFullYear(today.getFullYear() - 1)
      break
    default:
      from.setDate(today.getDate() - 29)
  }

  return { from: toISODate(from), to }
}

export function detectPreset(from: string, to: string): DatePreset {
  const today = toISODate(new Date())
  if (to !== today) return "custom"
  const diffDays = Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return "1d"
  if (diffDays === 6) return "7d"
  if (diffDays === 29) return "30d"
  if (diffDays === 89) return "90d"
  return "custom"
}

// ─── Default state ────────────────────────────────────────────────────────────

export function getDefaultFilters(): AnalyticsGlobalFilters {
  const r = presetRange("30d")
  const prev = getPrevPeriod(r.from, r.to)
  return {
    dateRange: r,
    comparisonRange: prev ?? null,
    granularity: "day",
    clauses: [],
  }
}

// ─── URL serialization ────────────────────────────────────────────────────────

/**
 * Encode filters as URL search params.
 * Uses individual params for date/granularity; base64-encodes clauses only when present.
 */
export function filtersToParams(filters: AnalyticsGlobalFilters): URLSearchParams {
  const p = new URLSearchParams()
  p.set("from", filters.dateRange.from)
  p.set("to", filters.dateRange.to)
  if (filters.comparisonRange) {
    p.set("cfrom", filters.comparisonRange.from)
    p.set("cto", filters.comparisonRange.to)
  }
  p.set("gran", filters.granularity)
  if (filters.clauses.length > 0) {
    try {
      p.set("f", btoa(JSON.stringify(filters.clauses)))
    } catch {
      // ignore if serialization fails
    }
  }
  return p
}

/**
 * Decode filters from URL search params.
 * Falls back to defaults for any missing or invalid params.
 */
export function filtersFromParams(
  params: URLSearchParams
): AnalyticsGlobalFilters {
  const defaults = getDefaultFilters()

  const from = params.get("from") ?? defaults.dateRange.from
  const to = params.get("to") ?? defaults.dateRange.to

  const cfrom = params.get("cfrom")
  const cto = params.get("cto")

  const gran = params.get("gran") as AnalyticsGranularity | null
  const validGran: AnalyticsGranularity[] = ["hour", "day", "week", "month"]

  let clauses: AnalyticsFilterClause[] = []
  const fParam = params.get("f")
  if (fParam) {
    try {
      const parsed = JSON.parse(atob(fParam))
      if (Array.isArray(parsed)) {
        clauses = parsed as AnalyticsFilterClause[]
      }
    } catch {
      // ignore invalid encoded clauses
    }
  }

  const comparisonRange =
    cfrom && cto ? { from: cfrom, to: cto } : defaults.comparisonRange

  return {
    dateRange: { from, to },
    comparisonRange: cfrom === "" ? null : comparisonRange,
    granularity: gran && validGran.includes(gran) ? gran : defaults.granularity,
    clauses,
  }
}

// ─── Filter clause mutations ───────────────────────────────────────────────────

export function addClause(
  filters: AnalyticsGlobalFilters,
  clause: AnalyticsFilterClause
): AnalyticsGlobalFilters {
  return { ...filters, clauses: [...filters.clauses, clause] }
}

export function removeClause(
  filters: AnalyticsGlobalFilters,
  clauseId: string
): AnalyticsGlobalFilters {
  return {
    ...filters,
    clauses: filters.clauses.filter((c) => c.id !== clauseId),
  }
}

export function updateClause(
  filters: AnalyticsGlobalFilters,
  clauseId: string,
  updates: Partial<AnalyticsFilterClause>
): AnalyticsGlobalFilters {
  return {
    ...filters,
    clauses: filters.clauses.map((c) =>
      c.id === clauseId ? { ...c, ...updates } : c
    ),
  }
}

export function clearClauses(
  filters: AnalyticsGlobalFilters
): AnalyticsGlobalFilters {
  return { ...filters, clauses: [] }
}

// ─── Filter dimension display labels ──────────────────────────────────────────

export const DIMENSION_LABELS: Record<AnalyticsFilterDimension, string> = {
  page: "Page",
  entry_page: "First page",
  exit_page: "Last page",
  viewed_page: "Viewed page",
  source: "Source",
  referrer: "Referring website",
  channel: "Channel",
  country: "Country",
  region: "Region",
  city: "City",
  device: "Device",
  browser: "Browser",
  os: "Operating system",
  screen_size: "Screen size",
  language: "Language",
  utm_source: "Campaign source",
  utm_medium: "Campaign medium",
  utm_campaign: "Campaign name",
  utm_content: "Campaign content",
  utm_term: "Campaign keyword",
  goal: "Goal",
  event: "Event",
}

export const OPERATOR_LABELS: Record<AnalyticsFilterOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  does_not_contain: "does not contain",
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

/** Format a duration in seconds to "Xm Ys" or "Xs". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/** Format a change ratio (0.12 => "+12%", -0.05 => "-5%"). */
export function formatChangeRatio(ratio: number): string {
  const pct = Math.round(Math.abs(ratio) * 100)
  return ratio >= 0 ? `+${pct}%` : `-${pct}%`
}

/** Format a metric value based on its unit. */
export function formatMetricValue(
  value: number,
  unit?: "count" | "percent" | "duration_seconds" | "currency"
): string {
  switch (unit) {
    case "percent":
      return formatPercent(value)
    case "duration_seconds":
      return formatDuration(value)
    case "currency":
      return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    default:
      return formatCount(value)
  }
}

/** Format an X-axis date label for charts. */
export function formatChartDate(
  label: string,
  granularity: AnalyticsGranularity
): string {
  if (granularity === "month") {
    const m = label.match(/^(\d{4})-(\d{2})$/)
    if (m) {
      return new Date(
        Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)
      ).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    }
  }
  if (granularity === "week") {
    const m = label.match(/^(\d{4})-W(\d{2})$/)
    if (m) {
      return `W${m[2]}`
    }
  }
  // day / hour
  try {
    return new Date(label).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  } catch {
    return label
  }
}

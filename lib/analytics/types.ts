/**
 * Shared, versioned contracts for the PostHog analytics dashboard.
 * Backend query/API modules and UI components must consume these types
 * rather than inventing parallel shapes.
 */

/** Bump when persisted layout shape changes in a breaking way. */
export const ANALYTICS_LAYOUT_VERSION = 1 as const

/** Content-table SK prefix: `analayout_<cognitoSub>`. */
export const ANALYTICS_LAYOUT_SK_PREFIX = "analayout_" as const

export const POSTHOG_PRIVATE_HOST = "https://us.posthog.com" as const

// ─── Widget catalog ──────────────────────────────────────────────────────────

export const DEFAULT_WIDGET_IDS = [
  "visitors",
  "pageviews",
  "bounce_rate",
  "visitors_over_time",
  "top_pages",
  "traffic_sources",
] as const

export type DefaultWidgetId = (typeof DEFAULT_WIDGET_IDS)[number]

export const ADVANCED_WIDGET_IDS = [
  // Audience
  "sessions",
  "new_vs_returning",
  "session_duration",
  "pages_per_session",
  "engaged_visits",
  "visit_frequency",
  "retention",
  "time_of_day",
  "day_of_week",
  // Content
  "entry_pages",
  "exit_pages",
  "time_on_page",
  "scroll_depth",
  "outbound_links",
  "downloads",
  "site_search",
  "page_paths",
  "page_transitions",
  // Acquisition
  "referrers",
  "channels",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "campaigns",
  "landing_pages_by_source",
  "new_returning_by_source",
  "paid_vs_organic",
  // Geography
  "countries",
  "regions",
  "cities",
  "timezones",
  "languages",
  "geo_map",
  // Technology
  "devices",
  "browsers",
  "browser_versions",
  "operating_systems",
  "os_versions",
  "screen_sizes",
  // Goals
  "goal_completions",
  "conversion_rate",
  "conversion_trend",
  "funnels",
  "form_submissions",
  "revenue",
  "custom_events",
  // Quality / real time
  "core_web_vitals",
  "slow_pages",
  "errors_404",
  "active_visitors",
  "active_pages",
  "live_sources",
] as const

export type AdvancedWidgetId = (typeof ADVANCED_WIDGET_IDS)[number]

export const ALL_WIDGET_IDS = [
  ...DEFAULT_WIDGET_IDS,
  ...ADVANCED_WIDGET_IDS,
] as const

export type AnalyticsWidgetId = (typeof ALL_WIDGET_IDS)[number]

export type WidgetCategory =
  | "default"
  | "audience"
  | "content"
  | "acquisition"
  | "geography"
  | "technology"
  | "goals"
  | "quality"

export type WidgetAvailability =
  | { status: "ready" }
  | { status: "needs_tracking"; reason: string }

export interface WidgetDefinition {
  id: AnalyticsWidgetId
  category: WidgetCategory
  title: string
  description: string
  /** When false, catalog shows the widget as disabled with `availability.reason`. */
  availability: WidgetAvailability
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
}

// ─── Grid layout ─────────────────────────────────────────────────────────────

/** One cell in a react-grid-layout breakpoint layout. */
export interface AnalyticsGridItem {
  i: AnalyticsWidgetId
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}

export type AnalyticsBreakpoint = "lg" | "md" | "sm"

/** 12-column desktop grid; narrower breakpoints collapse toward one column. */
export interface AnalyticsResponsiveLayouts {
  lg: AnalyticsGridItem[]
  md: AnalyticsGridItem[]
  sm: AnalyticsGridItem[]
}

export type WidgetDisplayOptions = Record<string, string | number | boolean>

export interface AnalyticsLayoutDocument {
  version: typeof ANALYTICS_LAYOUT_VERSION
  clientId: string
  cognitoSub: string
  widgetIds: AnalyticsWidgetId[]
  layouts: AnalyticsResponsiveLayouts
  /** Per-widget display options (metric mode, chart type, etc.). */
  widgetOptions?: Partial<Record<AnalyticsWidgetId, WidgetDisplayOptions>>
  updatedAt: string
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export type AnalyticsGranularity = "hour" | "day" | "week" | "month"

export interface AnalyticsDateRange {
  /** Inclusive YYYY-MM-DD (local studio timezone intent; API normalizes). */
  from: string
  /** Inclusive YYYY-MM-DD */
  to: string
}

export type AnalyticsFilterDimension =
  | "page"
  | "entry_page"
  | "exit_page"
  /** Sessions that included a matching pageview; applies to all widgets. */
  | "viewed_page"
  | "source"
  | "referrer"
  | "channel"
  | "country"
  | "region"
  | "city"
  | "device"
  | "browser"
  | "os"
  | "screen_size"
  | "language"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "goal"
  | "event"

export type AnalyticsFilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "does_not_contain"

/**
 * One filter row. Multiple `values` within a row combine with OR.
 * Separate rows / groups combine with AND.
 */
export interface AnalyticsFilterClause {
  id: string
  dimension: AnalyticsFilterDimension
  operator: AnalyticsFilterOperator
  values: string[]
}

export interface AnalyticsGlobalFilters {
  dateRange: AnalyticsDateRange
  /** Equal previous period when omitted by the client default. */
  comparisonRange: AnalyticsDateRange | null
  granularity: AnalyticsGranularity
  clauses: AnalyticsFilterClause[]
}

// ─── Educational help ────────────────────────────────────────────────────────

export type MetricDirectionPreference = "higher" | "lower" | "neutral"

/**
 * Typed next-step actions for metric help and Analytics 101.
 * Dispatched by the dashboard education action handler.
 */
export type AnalyticsHelpAction =
  | {
      kind: "focus_widget"
      label: string
      description?: string
      widgetId: AnalyticsWidgetId
    }
  | {
      kind: "open_filter"
      label: string
      description?: string
      dimension: AnalyticsFilterDimension
      /** Optional values prefilled in the filter builder. */
      values?: string[]
    }
  | {
      kind: "apply_filter"
      label: string
      description?: string
      clause: Omit<AnalyticsFilterClause, "id">
    }
  | {
      kind: "open_glossary"
      label: string
      description?: string
      /** Stable glossary term id from Analytics 101. */
      termId: string
    }
  | {
      kind: "navigate"
      label: string
      description?: string
      /** App-relative path; site editor is `/content`. */
      href: string
    }

/** Plain string (legacy) or a typed action object. */
export type MetricHelpNextStep = string | AnalyticsHelpAction

export interface MetricHelp {
  /** Stable key shared by KPI, column, legend, and chart tooltips. */
  id: string
  label: string
  meaning: string
  howCounted: string
  preference: MetricDirectionPreference
  /**
   * Broad reference range when defensible. Prefer null and site-vs-self
   * comparison guidance when no trustworthy universal target exists.
   */
  referenceRange: string | null
  contextNotes: string
  /**
   * One or two next steps. Prefer typed `AnalyticsHelpAction` objects;
   * plain strings remain accepted for backward compatibility only.
   */
  nextSteps: readonly [MetricHelpNextStep] | readonly [MetricHelpNextStep, MetricHelpNextStep]
  /**
   * Optional stable ID linking this metric to a term in the Analytics 101
   * glossary. Help popovers use this for "Learn more in Analytics 101".
   */
  glossaryTermId?: string
}

export function isAnalyticsHelpAction(
  step: MetricHelpNextStep
): step is AnalyticsHelpAction {
  return typeof step === "object" && step !== null && "kind" in step
}

export function metricHelpStepLabel(step: MetricHelpNextStep): string {
  return typeof step === "string" ? step : step.label
}

// ─── Query / dashboard results ───────────────────────────────────────────────

export type AnalyticsErrorCode =
  | "unauthorized"
  | "not_configured"
  | "invalid_credentials"
  | "insufficient_scope"
  | "query_failed"
  | "validation_error"
  | "not_found"
  | "rate_limited"
  | "unknown"

export interface AnalyticsWidgetError {
  widgetId: AnalyticsWidgetId
  code: AnalyticsErrorCode
  message: string
}

export interface MetricComparison {
  current: number
  previous: number | null
  /** (current - previous) / previous when previous is a non-zero number. */
  changeRatio: number | null
}

export interface TimeSeriesPoint {
  /** Bucket start as ISO date or datetime string. */
  t: string
  value: number
  previousValue?: number | null
}

export interface RankedRow {
  key: string
  label: string
  value: number
  share?: number
  previousValue?: number | null
  meta?: Record<string, string | number | null>
}

/**
 * One acquisition source with new vs returning visitor counts.
 * See `NEW_VISITOR_DEFINITION` in `lib/posthog/source-visitor-breakdown.ts`.
 */
export interface SourceVisitorBreakdownRow {
  key: string
  label: string
  newVisitors: number
  returningVisitors: number
  /** newVisitors + returningVisitors for ranking and share. */
  total: number
  share?: number
}

export type WidgetResultPayload =
  | { kind: "kpi"; metric: MetricComparison; unit?: "count" | "percent" | "duration_seconds" | "currency" }
  | { kind: "timeseries"; series: TimeSeriesPoint[]; unit?: "count" | "percent" }
  | { kind: "table"; rows: RankedRow[]; total?: number }
  | {
      kind: "source_visitor_breakdown"
      rows: SourceVisitorBreakdownRow[]
      total?: number
    }
  | { kind: "map"; rows: RankedRow[] }
  | { kind: "live"; activeVisitors: number; activePages: RankedRow[]; liveSources: RankedRow[] }
  | { kind: "empty"; reason?: string }

export interface WidgetResult {
  widgetId: AnalyticsWidgetId
  ok: true
  data: WidgetResultPayload
  helpIds?: string[]
}

export interface WidgetResultFailure {
  widgetId: AnalyticsWidgetId
  ok: false
  error: AnalyticsWidgetError
}

export type WidgetResultEntry = WidgetResult | WidgetResultFailure

export interface AnalyticsDashboardRequest {
  widgetIds: AnalyticsWidgetId[]
  filters: AnalyticsGlobalFilters
}

export interface AnalyticsDashboardResponse {
  filters: AnalyticsGlobalFilters
  results: Partial<Record<AnalyticsWidgetId, WidgetResultEntry>>
  fetchedAt: string
}

export interface AnalyticsFilterOption {
  value: string
  label: string
  count?: number
}

export interface AnalyticsFilterOptionsRequest {
  dimension: AnalyticsFilterDimension
  search?: string
  filters: AnalyticsGlobalFilters
  limit?: number
}

export interface AnalyticsFilterOptionsResponse {
  dimension: AnalyticsFilterDimension
  options: AnalyticsFilterOption[]
}

export interface AnalyticsLiveResponse {
  activeVisitors: number
  activePages: RankedRow[]
  liveSources: RankedRow[]
  fetchedAt: string
}

// ─── Connection / auth-facing status (safe for the browser) ──────────────────

export type AnalyticsConnectionState =
  | { state: "unavailable" }
  | { state: "error"; code: AnalyticsErrorCode; message: string }
  | { state: "ready"; projectId: string }

export function isAnalyticsWidgetId(value: string): value is AnalyticsWidgetId {
  return (ALL_WIDGET_IDS as readonly string[]).includes(value)
}

export function isDefaultWidgetId(value: string): value is DefaultWidgetId {
  return (DEFAULT_WIDGET_IDS as readonly string[]).includes(value)
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  AnalyticsFilterDimension,
  AnalyticsGlobalFilters,
  AnalyticsWidgetId,
  WidgetResultEntry,
} from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { WIDGET_TITLES } from "./analytics-help-data"
import { AnalyticsAreaChart } from "./chart-area"
import { HelpPopover } from "./help-popover"
import { KpiCard } from "./kpi-card"
import { RankedTable } from "./table-ranked"
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "./widget-states"

// ─── Widget click-to-filter dimension map ─────────────────────────────────────

/**
 * Maps a widget ID to the filter dimension that should be applied
 * when a user clicks a row inside that widget.
 */
const WIDGET_CLICK_DIMENSION: Partial<
  Record<AnalyticsWidgetId, AnalyticsFilterDimension>
> = {
  top_pages: "page",
  traffic_sources: "source",
  referrers: "referrer",
  channels: "channel",
  countries: "country",
  regions: "region",
  cities: "city",
  devices: "device",
  browsers: "browser",
  operating_systems: "os",
  languages: "language",
  entry_pages: "entry_page",
  exit_pages: "exit_page",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
}

// ─── Widget preference map ─────────────────────────────────────────────────────

const WIDGET_PREFERENCE: Partial<
  Record<AnalyticsWidgetId, "higher" | "lower" | "neutral">
> = {
  visitors: "higher",
  pageviews: "higher",
  bounce_rate: "lower",
  sessions: "higher",
  new_vs_returning: "neutral",
  session_duration: "higher",
  pages_per_session: "higher",
  engaged_visits: "higher",
  conversion_rate: "higher",
  goal_completions: "higher",
}

// ─── Widget unit map ──────────────────────────────────────────────────────────

const WIDGET_UNIT: Partial<
  Record<AnalyticsWidgetId, "count" | "percent" | "duration_seconds">
> = {
  bounce_rate: "percent",
  session_duration: "duration_seconds",
  pages_per_session: "count",
  conversion_rate: "percent",
}

// ─── Widget card wrapper ──────────────────────────────────────────────────────

function WidgetCard({
  id,
  children,
  className,
}: {
  id: AnalyticsWidgetId
  children: React.ReactNode
  className?: string
}) {
  const title = WIDGET_TITLES[id] ?? id
  const helpId = id

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {title}
          <HelpPopover metricId={helpId} side="top" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  )
}

// ─── WidgetRenderer ───────────────────────────────────────────────────────────

interface WidgetRendererProps {
  id: AnalyticsWidgetId
  result: WidgetResultEntry | undefined
  loading: boolean
  filters: AnalyticsGlobalFilters
  onFilterAdd: (
    dimension: AnalyticsFilterDimension,
    value: string
  ) => void
  className?: string
}

/**
 * Dispatches to the appropriate view component based on the widget ID
 * and result payload kind. Handles loading, error, and empty states.
 */
export function WidgetRenderer({
  id,
  result,
  loading,
  filters,
  onFilterAdd,
  className,
}: WidgetRendererProps) {
  const title = WIDGET_TITLES[id] ?? id

  // ── Loading ──
  if (loading && !result) {
    const variant =
      id === "visitors_over_time"
        ? "chart"
        : id === "top_pages" || id === "traffic_sources"
          ? "table"
          : "kpi"
    return (
      <Card className={cn("flex flex-col", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetSkeleton variant={variant} />
        </CardContent>
      </Card>
    )
  }

  // ── Error ──
  if (result && !result.ok) {
    return (
      <WidgetCard id={id} className={className}>
        <WidgetError message={result.error.message} />
      </WidgetCard>
    )
  }

  // ── No result yet ──
  if (!result) {
    return (
      <WidgetCard id={id} className={className}>
        <WidgetEmpty />
      </WidgetCard>
    )
  }

  const data = result.data
  const showComparison = filters.comparisonRange !== null
  const clickDimension = WIDGET_CLICK_DIMENSION[id]

  // ── KPI ──
  if (data.kind === "kpi") {
    return (
      <KpiCard
        title={title}
        helpId={id}
        metric={data.metric}
        unit={data.unit ?? WIDGET_UNIT[id] ?? "count"}
        preference={WIDGET_PREFERENCE[id] ?? "higher"}
        className={className}
      />
    )
  }

  // ── Timeseries ──
  if (data.kind === "timeseries") {
    return (
      <WidgetCard id={id} className={className}>
        <AnalyticsAreaChart
          series={data.series}
          granularity={filters.granularity}
          unit={data.unit ?? "count"}
          showComparison={showComparison}
          height={260}
        />
      </WidgetCard>
    )
  }

  // ── Table ──
  if (data.kind === "table") {
    return (
      <WidgetCard id={id} className={className}>
        <RankedTable
          rows={data.rows}
          total={data.total}
          clickDimension={clickDimension}
          onRowClick={
            clickDimension
              ? (dim, val) => onFilterAdd(dim, val)
              : undefined
          }
          showComparison={showComparison}
          maxRows={10}
        />
      </WidgetCard>
    )
  }

  // ── Empty ──
  if (data.kind === "empty") {
    return (
      <WidgetCard id={id} className={className}>
        <WidgetEmpty reason={data.reason} />
      </WidgetCard>
    )
  }

  // ── Live / map (not default widgets, future) ──
  return (
    <WidgetCard id={id} className={className}>
      <WidgetEmpty reason="This widget type is not yet supported in this view." />
    </WidgetCard>
  )
}

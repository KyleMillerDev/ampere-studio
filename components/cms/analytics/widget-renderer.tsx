"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  AnalyticsFilterDimension,
  AnalyticsGlobalFilters,
  AnalyticsWidgetId,
  WidgetResultEntry,
} from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import {
  WIDGET_TABLE_NAME_LABELS,
  WIDGET_TITLES,
} from "./analytics-help-data"
import { AnalyticsAreaChart } from "./chart-area"
import {
  userFacingTrackingReason,
  widgetAnchorId,
} from "./education-actions"
import { HelpPopover } from "./help-popover"
import { KpiCard } from "./kpi-card"
import { SourceVisitorTable } from "./source-visitor-table"
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
  new_returning_by_source: "source",
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
  highlighted,
}: {
  id: AnalyticsWidgetId
  children: React.ReactNode
  className?: string
  highlighted?: boolean
}) {
  const title = WIDGET_TITLES[id] ?? id
  const helpId = id

  return (
    <Card
      id={widgetAnchorId(id)}
      data-analytics-widget={id}
      tabIndex={-1}
      className={cn(
        "flex flex-col outline-none transition-shadow duration-300",
        highlighted && "ring-2 ring-primary shadow-md",
        className
      )}
    >
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
  highlighted?: boolean
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
  highlighted,
}: WidgetRendererProps) {
  const title = WIDGET_TITLES[id] ?? id

  // ── Loading ──
  if (loading && !result) {
    const variant =
      id === "visitors_over_time"
        ? "chart"
        : id === "top_pages" ||
            id === "traffic_sources" ||
            id === "new_returning_by_source"
          ? "table"
          : "kpi"
    return (
      <Card
        id={widgetAnchorId(id)}
        data-analytics-widget={id}
        tabIndex={-1}
        className={cn(
          "flex flex-col outline-none transition-shadow duration-300",
          highlighted && "ring-2 ring-primary shadow-md",
          className
        )}
      >
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
      <WidgetCard id={id} className={className} highlighted={highlighted}>
        <WidgetError
          message={userFacingTrackingReason(result.error.message)}
        />
      </WidgetCard>
    )
  }

  // ── No result yet ──
  if (!result) {
    return (
      <WidgetCard id={id} className={className} highlighted={highlighted}>
        <WidgetEmpty />
      </WidgetCard>
    )
  }

  const data = result.data
  const showComparison = filters.comparisonRange !== null
  const clickDimension = WIDGET_CLICK_DIMENSION[id]
  const nameColumnLabel = WIDGET_TABLE_NAME_LABELS[id] ?? "Item"

  // ── KPI ──
  if (data.kind === "kpi") {
    return (
      <div
        id={widgetAnchorId(id)}
        data-analytics-widget={id}
        tabIndex={-1}
        className={cn(
          "outline-none transition-shadow duration-300 rounded-xl",
          highlighted && "ring-2 ring-primary shadow-md"
        )}
      >
        <KpiCard
          title={title}
          helpId={id}
          metric={data.metric}
          unit={data.unit ?? WIDGET_UNIT[id] ?? "count"}
          preference={WIDGET_PREFERENCE[id] ?? "higher"}
          className={className}
        />
      </div>
    )
  }

  // ── Timeseries ──
  if (data.kind === "timeseries") {
    return (
      <WidgetCard id={id} className={className} highlighted={highlighted}>
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
      <WidgetCard id={id} className={className} highlighted={highlighted}>
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
          nameColumnLabel={nameColumnLabel}
        />
      </WidgetCard>
    )
  }

  // ── Source × new/returning breakdown ──
  if (data.kind === "source_visitor_breakdown") {
    return (
      <WidgetCard id={id} className={className} highlighted={highlighted}>
        <SourceVisitorTable
          rows={data.rows}
          total={data.total}
          onSourceClick={(sourceKey) => onFilterAdd("source", sourceKey)}
          maxRows={15}
        />
      </WidgetCard>
    )
  }

  // ── Empty ──
  if (data.kind === "empty") {
    return (
      <WidgetCard id={id} className={className} highlighted={highlighted}>
        <WidgetEmpty reason={data.reason} />
      </WidgetCard>
    )
  }

  // ── Live / map (not default widgets, future) ──
  return (
    <WidgetCard id={id} className={className} highlighted={highlighted}>
      <WidgetEmpty reason="This widget type is not yet supported in this view." />
    </WidgetCard>
  )
}

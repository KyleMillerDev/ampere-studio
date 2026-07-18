"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { AnalyticsGranularity, TimeSeriesPoint } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import {
  formatChartDate,
  formatCount,
  formatMetricValue,
} from "./analytics-filter-utils"

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLOR_CURRENT = "var(--primary)"
const COLOR_PREV = "oklch(65% 0.04 220)"

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function AnalyticsTooltip({
  active,
  payload,
  label,
  granularity,
  unit,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
  granularity: AnalyticsGranularity
  unit?: "count" | "percent" | "duration_seconds"
}) {
  if (!active || !payload?.length || !label) return null
  const formatted = formatChartDate(label, granularity)

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium text-foreground">{formatted}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => (
          <p
            key={p.dataKey}
            className="flex items-center gap-2"
            style={{ color: p.color ?? COLOR_CURRENT }}
          >
            <span className="text-xs">{p.name}:</span>
            <span className="font-medium tabular-nums">
              {formatMetricValue(p.value ?? 0, unit ?? "count")}
            </span>
          </p>
        )
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  t: string
  value: number
  previousValue?: number | null
}

function toChartPoints(series: TimeSeriesPoint[]): ChartPoint[] {
  return series.map((pt) => ({
    t: pt.t,
    value: pt.value,
    ...(pt.previousValue !== undefined
      ? { previousValue: pt.previousValue ?? undefined }
      : {}),
  }))
}

// ─── AnalyticsAreaChart ───────────────────────────────────────────────────────

interface AnalyticsAreaChartProps {
  series: TimeSeriesPoint[]
  granularity: AnalyticsGranularity
  unit?: "count" | "percent"
  showComparison?: boolean
  height?: number
  className?: string
}

/**
 * Full-width area chart for the visitors over time widget.
 * Supports optional previous-period overlay.
 */
export function AnalyticsAreaChart({
  series,
  granularity,
  unit = "count",
  showComparison = true,
  height = 260,
  className,
}: AnalyticsAreaChartProps) {
  const data = toChartPoints(series)
  const hasPrev = showComparison && data.some((d) => d.previousValue != null)

  function tickFormatter(v: string) {
    return formatChartDate(v, granularity)
  }

  function yFormatter(v: number) {
    return unit === "percent" ? `${v}%` : formatCount(v)
  }

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="anaGradCurr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_CURRENT} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLOR_CURRENT} stopOpacity={0.02} />
            </linearGradient>
            {hasPrev && (
              <linearGradient id="anaGradPrev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_PREV} stopOpacity={0.12} />
                <stop offset="100%" stopColor={COLOR_PREV} stopOpacity={0.01} />
              </linearGradient>
            )}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border/50"
            vertical={false}
          />
          <XAxis
            dataKey="t"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={yFormatter}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <RechartsTooltip
            content={
              <AnalyticsTooltip granularity={granularity} unit={unit} />
            }
          />

          {hasPrev && (
            <Area
              type="monotone"
              dataKey="previousValue"
              name="Prior period"
              stroke={COLOR_PREV}
              strokeWidth={1.5}
              strokeOpacity={0.7}
              strokeDasharray="4 2"
              fill="url(#anaGradPrev)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            name="Current"
            stroke={COLOR_CURRENT}
            strokeWidth={2}
            fill="url(#anaGradCurr)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── AnalyticsSparkline ────────────────────────────────────────────────────────

interface AnalyticsSparklineProps {
  series: TimeSeriesPoint[]
  height?: number
  className?: string
}

/**
 * A minimal sparkline for inline use (e.g. inside a KPI card or table row).
 */
export function AnalyticsSparkline({
  series,
  height = 40,
  className,
}: AnalyticsSparklineProps) {
  const data = toChartPoints(series)
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={COLOR_CURRENT}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

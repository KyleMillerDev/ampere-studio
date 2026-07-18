"use client"

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MetricComparison } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { formatChangeRatio, formatMetricValue } from "./analytics-filter-utils"
import { HelpPopover } from "./help-popover"

interface KpiCardProps {
  title: string
  helpId?: string
  metric: MetricComparison
  unit?: "count" | "percent" | "duration_seconds" | "currency"
  /** Whether higher is better (affects color on change indicator). */
  preference?: "higher" | "lower" | "neutral"
  className?: string
}

/**
 * A clean stat card showing a KPI value with an optional comparison delta.
 * Used for Visitors, Pageviews, and Bounce rate.
 */
export function KpiCard({
  title,
  helpId,
  metric,
  unit,
  preference = "higher",
  className,
}: KpiCardProps) {
  const { current, previous, changeRatio } = metric

  const formattedValue = formatMetricValue(current, unit)
  const formattedPrev =
    previous !== null && previous !== undefined
      ? formatMetricValue(previous, unit)
      : null

  const isUp = changeRatio !== null && changeRatio > 0
  const isDown = changeRatio !== null && changeRatio < 0
  const isFlat = changeRatio !== null && changeRatio === 0

  // Determine if the change is "good" for color coding.
  const changeIsGood =
    preference === "neutral"
      ? null
      : preference === "higher"
        ? isUp
        : isDown // lower is better (bounce rate)

  const changeColor =
    changeIsGood === null
      ? "text-muted-foreground"
      : changeIsGood
        ? "text-emerald-500"
        : "text-destructive"

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {title}
          {helpId && <HelpPopover metricId={helpId} side="top" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        {/* Main value */}
        <div>
          <p className="text-3xl font-semibold tracking-tight font-heading tabular-nums">
            {formattedValue}
          </p>

          {/* Comparison row */}
          {changeRatio !== null && (
            <div className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", changeColor)}>
              {isUp && <ArrowUpIcon className="size-3 shrink-0" />}
              {isDown && <ArrowDownIcon className="size-3 shrink-0" />}
              {isFlat && <MinusIcon className="size-3 shrink-0" />}
              <span>{formatChangeRatio(changeRatio)}</span>
              {formattedPrev && (
                <span className="ml-1 font-normal text-muted-foreground">
                  vs {formattedPrev}
                </span>
              )}
            </div>
          )}

          {/* No comparison period */}
          {changeRatio === null && formattedPrev && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              vs {formattedPrev} prior period
            </p>
          )}
          {changeRatio === null && !formattedPrev && previous === null && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No comparison period
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

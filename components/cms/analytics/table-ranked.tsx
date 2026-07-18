"use client"

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import type {
  AnalyticsFilterDimension,
  RankedRow,
} from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { formatCount, formatChangeRatio, formatPercent } from "./analytics-filter-utils"

interface RankedTableProps {
  rows: RankedRow[]
  total?: number
  /**
   * Which filter dimension to apply when a row is clicked.
   * When undefined, rows are not clickable.
   */
  clickDimension?: AnalyticsFilterDimension
  onRowClick?: (dimension: AnalyticsFilterDimension, value: string) => void
  /** Show a previous-period comparison column. */
  showComparison?: boolean
  /** Format values as percentages (for bounce rate tables etc.) */
  valueAsPercent?: boolean
  /** Max rows to show before truncating. */
  maxRows?: number
  emptyMessage?: string
  className?: string
}

/**
 * A ranked table with horizontal share bars, click-to-filter on rows,
 * and optional previous-period comparison.
 */
export function RankedTable({
  rows,
  total: _total,
  clickDimension,
  onRowClick,
  showComparison = false,
  valueAsPercent = false,
  maxRows = 10,
  emptyMessage = "No data for this period.",
  className,
}: RankedTableProps) {
  const visible = rows.slice(0, maxRows)
  const maxValue = visible.reduce((m, r) => Math.max(m, r.value), 0)

  if (visible.length === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </p>
    )
  }

  const isClickable = !!(clickDimension && onRowClick)

  return (
    <div className={cn("", className)}>
      {/* Column headers */}
      <div className="mb-1 flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
        <span>Page / Source</span>
        <div className="flex items-center gap-4">
          {showComparison && <span className="w-16 text-right">Prior</span>}
          <span className="w-16 text-right">Visitors</span>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {visible.map((row, i) => {
          const barWidth = maxValue > 0 ? (row.value / maxValue) * 100 : 0

          const changeRatio =
            showComparison &&
            row.previousValue != null &&
            row.previousValue !== 0
              ? (row.value - row.previousValue) / Math.abs(row.previousValue)
              : null
          const isUp = changeRatio !== null && changeRatio > 0

          return (
            <li key={row.key ?? i} className="relative">
              {/* Share bar (background) */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-sm bg-primary/6 transition-all"
                style={{ width: `${barWidth}%` }}
                aria-hidden
              />

              <button
                type="button"
                disabled={!isClickable}
                onClick={() =>
                  isClickable &&
                  onRowClick!(clickDimension!, row.key)
                }
                className={cn(
                  "relative flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left text-sm",
                  isClickable &&
                    "cursor-pointer rounded-sm hover:bg-muted/60 transition-colors",
                  !isClickable && "cursor-default"
                )}
                title={isClickable ? `Filter by "${row.label}"` : undefined}
              >
                {/* Label */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground/50 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium leading-tight">
                      {row.label || row.key}
                    </span>
                    {row.share !== undefined && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatPercent(row.share * 100, 0)} of total
                      </span>
                    )}
                  </span>
                </span>

                {/* Values */}
                <div className="flex shrink-0 items-center gap-4">
                  {showComparison && (
                    <span className="w-16 text-right tabular-nums">
                      {changeRatio !== null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-medium",
                            isUp ? "text-emerald-500" : "text-destructive"
                          )}
                        >
                          {isUp ? (
                            <ArrowUpIcon className="size-2.5" />
                          ) : (
                            <ArrowDownIcon className="size-2.5" />
                          )}
                          {formatChangeRatio(changeRatio)}
                        </span>
                      ) : row.previousValue != null ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {valueAsPercent
                            ? formatPercent(row.previousValue)
                            : formatCount(row.previousValue)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </span>
                  )}
                  <span className="w-16 text-right text-sm font-medium tabular-nums">
                    {valueAsPercent
                      ? formatPercent(row.value)
                      : formatCount(row.value)}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {rows.length > maxRows && (
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          Showing {maxRows} of {rows.length} rows.
        </p>
      )}
    </div>
  )
}

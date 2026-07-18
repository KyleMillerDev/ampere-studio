"use client"

import type { SourceVisitorBreakdownRow } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { formatCount, formatPercent } from "./analytics-filter-utils"

interface SourceVisitorTableProps {
  rows: SourceVisitorBreakdownRow[]
  total?: number
  onSourceClick?: (sourceKey: string) => void
  maxRows?: number
  emptyMessage?: string
  className?: string
}

/**
 * Table for new vs returning visitors broken down by traffic source.
 * Rows are clickable when `onSourceClick` is provided (filters by source).
 */
export function SourceVisitorTable({
  rows,
  onSourceClick,
  maxRows = 15,
  emptyMessage = "No source data for this period.",
  className,
}: SourceVisitorTableProps) {
  const visible = rows.slice(0, maxRows)
  const maxTotal = visible.reduce((m, r) => Math.max(m, r.total), 0)

  if (visible.length === 0) {
    return (
      <p
        className={cn(
          "py-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {emptyMessage}
      </p>
    )
  }

  const isClickable = !!onSourceClick

  return (
    <div className={cn("", className)}>
      <div className="mb-1 flex items-center justify-between gap-2 px-2 text-xs font-medium text-muted-foreground">
        <span className="min-w-0 flex-1">Source</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="w-14 text-right">New</span>
          <span className="w-16 text-right">Returning</span>
          <span className="w-12 text-right">Share</span>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {visible.map((row, i) => {
          const barWidth = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0
          return (
            <li key={row.key ?? i} className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-sm bg-primary/6 transition-all"
                style={{ width: `${barWidth}%` }}
              />
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onSourceClick(row.key)}
                  className={cn(
                    "relative flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm",
                    "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  )}
                  title={`Filter dashboard to ${row.label}`}
                >
                  <SourceRowContent row={row} />
                </button>
              ) : (
                <div className="relative flex w-full items-center justify-between gap-2 px-2 py-2 text-sm">
                  <SourceRowContent row={row} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SourceRowContent({ row }: { row: SourceVisitorBreakdownRow }) {
  return (
    <>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {row.label}
      </span>
      <div className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
        <span className="w-14 text-right text-foreground">
          {formatCount(row.newVisitors)}
        </span>
        <span className="w-16 text-right text-foreground">
          {formatCount(row.returningVisitors)}
        </span>
        <span className="w-12 text-right">
          {row.share != null ? formatPercent(row.share * 100, 0) : "-"}
        </span>
      </div>
    </>
  )
}

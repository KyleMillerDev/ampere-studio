"use client"

import { XIcon } from "lucide-react"

import type { AnalyticsFilterClause } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { DIMENSION_LABELS, OPERATOR_LABELS } from "./analytics-filter-utils"

interface FilterBadgeProps {
  clause: AnalyticsFilterClause
  onRemove: (id: string) => void
  className?: string
}

/**
 * A removable chip that summarizes one active filter clause.
 * Clicking the X removes it; clicking elsewhere (future) could open edit.
 */
export function FilterBadge({ clause, onRemove, className }: FilterBadgeProps) {
  const dimension = DIMENSION_LABELS[clause.dimension] ?? clause.dimension
  const operator = OPERATOR_LABELS[clause.operator] ?? clause.operator
  const values =
    clause.values.length === 1
      ? clause.values[0]
      : clause.values.length <= 3
        ? clause.values.join(", ")
        : `${clause.values.slice(0, 2).join(", ")} +${clause.values.length - 2} more`

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary",
        className
      )}
    >
      <span className="text-muted-foreground font-normal">{dimension}</span>
      <span className="opacity-60">{operator}</span>
      <span className="max-w-40 truncate">{values}</span>
      <button
        type="button"
        onClick={() => onRemove(clause.id)}
        aria-label={`Remove filter: ${dimension} ${operator} ${values}`}
        className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
      >
        <XIcon className="size-2.5" />
      </button>
    </span>
  )
}

interface FilterBadgeRailProps {
  clauses: AnalyticsFilterClause[]
  onRemove: (id: string) => void
  onClearAll: () => void
}

/** Renders all active filter badges plus a "Clear all" link when present. */
export function FilterBadgeRail({
  clauses,
  onRemove,
  onClearAll,
}: FilterBadgeRailProps) {
  if (clauses.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {clauses.map((clause) => (
        <FilterBadge key={clause.id} clause={clause} onRemove={onRemove} />
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="px-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        Clear all
      </button>
    </div>
  )
}

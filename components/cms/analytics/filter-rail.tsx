"use client"

import { useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  PlusIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type {
  AnalyticsFilterClause,
  AnalyticsFilterDimension,
  AnalyticsGlobalFilters,
  AnalyticsGranularity,
} from "@/lib/analytics/types"

import {
  DATE_PRESET_LABELS,
  DatePreset,
  autoGranularity,
  detectPreset,
  getPrevPeriod,
  presetRange,
} from "./analytics-filter-utils"
import { FilterClauseBuilder } from "./filter-clause-builder"

/** Request from education actions to open the filter builder prefilled. */
export interface FilterBuilderRequest {
  dimension: AnalyticsFilterDimension
  values?: string[]
  /** Bump to re-open even when dimension/values are unchanged. */
  token: number
}

interface FilterRailProps {
  filters: AnalyticsGlobalFilters
  loading: boolean
  onFiltersChange: (next: AnalyticsGlobalFilters) => void
  onRefresh: () => void
  /** When set/updated, opens the Add filter popover with a preselected dimension. */
  filterBuilderRequest?: FilterBuilderRequest | null
  onFilterBuilderRequestHandled?: () => void
}

// ─── Granularity toggle segment ────────────────────────────────────────────────

function GranularityToggle({
  value,
  onChange,
}: {
  value: AnalyticsGranularity
  onChange: (g: AnalyticsGranularity) => void
}) {
  const options: { v: AnalyticsGranularity; label: string }[] = [
    { v: "day", label: "Day" },
    { v: "week", label: "Week" },
    { v: "month", label: "Month" },
  ]
  return (
    <div className="flex rounded-md border bg-background">
      {options.map(({ v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-[calc(var(--radius)-2px)] last:rounded-r-[calc(var(--radius)-2px)] ${
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Date range popover ────────────────────────────────────────────────────────

function DateRangePopover({
  filters,
  onFiltersChange,
}: {
  filters: AnalyticsGlobalFilters
  onFiltersChange: (next: AnalyticsGlobalFilters) => void
}) {
  const { from, to } = filters.dateRange
  const preset = detectPreset(from, to)

  function applyPreset(p: DatePreset) {
    if (p === "custom") return
    const r = presetRange(p)
    const prev = getPrevPeriod(r.from, r.to)
    const gran = autoGranularity(r.from, r.to)
    onFiltersChange({
      ...filters,
      dateRange: r,
      comparisonRange: filters.comparisonRange ? (prev ?? null) : null,
      granularity: gran,
    })
  }

  function applyCustomDate(field: "from" | "to", value: string) {
    const next = { ...filters.dateRange, [field]: value }
    const prev = filters.comparisonRange
      ? getPrevPeriod(next.from, next.to)
      : null
    onFiltersChange({
      ...filters,
      dateRange: next,
      comparisonRange: prev ?? null,
    })
  }

  const displayLabel =
    preset === "custom"
      ? `${from} to ${to}`
      : DATE_PRESET_LABELS[preset]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-0 px-3 text-sm font-normal">
          <span className="text-xs font-medium text-muted-foreground">
            Period
          </span>
          <span className="mx-2 h-3 w-px bg-border" />
          <span className="font-medium">{displayLabel}</span>
          <ChevronDownIcon className="ml-1.5 size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="flex">
          {/* Preset list */}
          <div className="w-40 border-r py-1.5">
            {(["1d", "7d", "30d", "90d", "6m", "12m"] as DatePreset[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`flex w-full items-center justify-between px-4 py-1.5 text-sm transition-colors hover:bg-muted ${
                    preset === p
                      ? "font-medium text-primary"
                      : "text-foreground"
                  }`}
                >
                  {DATE_PRESET_LABELS[p]}
                  {preset === p && (
                    <CheckIcon className="size-3.5 text-primary" />
                  )}
                </button>
              )
            )}
            <hr className="my-1 border-border" />
            <button
              type="button"
              onClick={() => {/* just lets user enter custom dates below */}}
              className={`flex w-full items-center justify-between px-4 py-1.5 text-sm transition-colors hover:bg-muted ${
                preset === "custom"
                  ? "font-medium text-primary"
                  : "text-foreground"
              }`}
            >
              Custom
              {preset === "custom" && (
                <CheckIcon className="size-3.5 text-primary" />
              )}
            </button>
          </div>
          {/* Custom date inputs */}
          <div className="flex-1 space-y-3 p-4">
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => applyCustomDate("from", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => applyCustomDate("to", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Compare toggle ────────────────────────────────────────────────────────────

function CompareToggle({
  filters,
  onFiltersChange,
}: {
  filters: AnalyticsGlobalFilters
  onFiltersChange: (next: AnalyticsGlobalFilters) => void
}) {
  const enabled = filters.comparisonRange !== null

  function toggle() {
    if (enabled) {
      onFiltersChange({ ...filters, comparisonRange: null })
    } else {
      const prev = getPrevPeriod(filters.dateRange.from, filters.dateRange.to)
      onFiltersChange({ ...filters, comparisonRange: prev ?? null })
    }
  }

  const prevLabel =
    filters.comparisonRange
      ? `vs ${filters.comparisonRange.from} to ${filters.comparisonRange.to}`
      : null

  return (
    <div className="flex h-9 items-center overflow-hidden rounded-md border bg-background text-sm">
      <button
        type="button"
        onClick={toggle}
        className="flex h-full items-center gap-1.5 px-3 transition-colors hover:bg-muted/60"
      >
        {enabled ? (
          <XIcon className="size-3.5 text-muted-foreground" />
        ) : null}
        <span
          className={enabled ? "text-foreground" : "text-muted-foreground"}
        >
          Compare
        </span>
      </button>
      {enabled && prevLabel && (
        <>
          <span className="h-4 w-px bg-border" />
          <span className="flex h-full items-center px-3 text-xs text-muted-foreground">
            {prevLabel}
          </span>
        </>
      )}
    </div>
  )
}

// ─── Add filter button ─────────────────────────────────────────────────────────

function AddFilterButton({
  filters,
  onClauseAdd,
  filterBuilderRequest,
  onFilterBuilderRequestHandled,
}: {
  filters: AnalyticsGlobalFilters
  onClauseAdd: (clause: AnalyticsFilterClause) => void
  filterBuilderRequest?: FilterBuilderRequest | null
  onFilterBuilderRequestHandled?: () => void
}) {
  const [userOpen, setUserOpen] = useState(false)
  const requestActive = filterBuilderRequest != null
  const open = userOpen || requestActive
  const prefillDimension = filterBuilderRequest?.dimension ?? "page"
  const prefillValues = filterBuilderRequest?.values
  const builderKey = filterBuilderRequest?.token ?? 0

  function closeBuilder() {
    setUserOpen(false)
    if (requestActive) onFilterBuilderRequestHandled?.()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setUserOpen(true)
          return
        }
        closeBuilder()
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
          <FilterIcon className="size-3.5" />
          Filter
          <PlusIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start" sideOffset={6}>
        <FilterClauseBuilder
          key={builderKey}
          filters={filters}
          initialDimension={prefillDimension}
          initialValues={prefillValues}
          onAdd={(clause) => {
            onClauseAdd(clause)
            closeBuilder()
          }}
          onCancel={closeBuilder}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Main FilterRail ──────────────────────────────────────────────────────────

export function FilterRail({
  filters,
  loading,
  onFiltersChange,
  onRefresh,
  filterBuilderRequest,
  onFilterBuilderRequestHandled,
}: FilterRailProps) {
  function handleGranularity(gran: AnalyticsGranularity) {
    onFiltersChange({ ...filters, granularity: gran })
  }

  function handleClauseAdd(clause: AnalyticsFilterClause) {
    onFiltersChange({ ...filters, clauses: [...filters.clauses, clause] })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePopover filters={filters} onFiltersChange={onFiltersChange} />

      <GranularityToggle
        value={filters.granularity}
        onChange={handleGranularity}
      />

      <CompareToggle filters={filters} onFiltersChange={onFiltersChange} />

      <AddFilterButton
        filters={filters}
        onClauseAdd={handleClauseAdd}
        filterBuilderRequest={filterBuilderRequest}
        onFilterBuilderRequestHandled={onFilterBuilderRequestHandled}
      />

      <Button
        variant="outline"
        size="icon"
        className="ml-auto h-9 w-9"
        onClick={onRefresh}
        title="Refresh"
        disabled={loading}
      >
        <RefreshCwIcon
          className={`size-4 ${loading ? "animate-spin" : ""}`}
        />
      </Button>
    </div>
  )
}

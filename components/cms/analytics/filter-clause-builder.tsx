"use client"

import { useState } from "react"
import { Loader2Icon, XIcon } from "lucide-react"
import { v4 as uuid } from "uuid"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  AnalyticsFilterClause,
  AnalyticsFilterDimension,
  AnalyticsFilterOperator,
  AnalyticsGlobalFilters,
} from "@/lib/analytics/types"

import {
  DIMENSION_LABELS,
  OPERATOR_LABELS,
} from "./analytics-filter-utils"
import { useFilterOptions } from "./use-analytics"

const OPERATOR_OPTIONS: AnalyticsFilterOperator[] = [
  "is",
  "is_not",
  "contains",
  "does_not_contain",
]

const DIMENSION_OPTIONS: AnalyticsFilterDimension[] = [
  "page",
  "entry_page",
  "exit_page",
  "viewed_page",
  "source",
  "referrer",
  "channel",
  "country",
  "region",
  "city",
  "device",
  "browser",
  "os",
  "screen_size",
  "language",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "goal",
  "event",
]

interface FilterClauseBuilderProps {
  filters: AnalyticsGlobalFilters
  onAdd: (clause: AnalyticsFilterClause) => void
  onCancel: () => void
  /** Preselect a dimension when opened from an education action. */
  initialDimension?: AnalyticsFilterDimension
  /** Prefill selected values (still editable before Apply). */
  initialValues?: string[]
}

export function FilterClauseBuilder({
  filters,
  onAdd,
  onCancel,
  initialDimension = "page",
  initialValues,
}: FilterClauseBuilderProps) {
  const [dimension, setDimension] =
    useState<AnalyticsFilterDimension>(initialDimension)
  const [operator, setOperator] = useState<AnalyticsFilterOperator>("is")
  const [search, setSearch] = useState("")
  const [selectedValues, setSelectedValues] = useState<string[]>(
    () => initialValues?.slice() ?? []
  )
  const [manualInput, setManualInput] = useState("")

  function changeDimension(next: AnalyticsFilterDimension) {
    setDimension(next)
    setSelectedValues([])
    setSearch("")
    setManualInput("")
  }

  const optionsState = useFilterOptions(dimension, search, filters)

  function toggleValue(value: string) {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function addManual() {
    const val = manualInput.trim()
    if (!val || selectedValues.includes(val)) return
    setSelectedValues((prev) => [...prev, val])
    setManualInput("")
  }

  function handleAdd() {
    if (selectedValues.length === 0) return
    onAdd({
      id: uuid(),
      dimension,
      operator,
      values: selectedValues,
    })
  }

  const canAdd = selectedValues.length > 0

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Add filter</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Dimension + Operator row */}
      <div className="flex gap-2 p-4 pb-2">
        <Select
          value={dimension}
          onValueChange={(v) =>
            changeDimension(v as AnalyticsFilterDimension)
          }
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIMENSION_OPTIONS.map((d) => (
              <SelectItem key={d} value={d} className="text-xs">
                {DIMENSION_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={operator}
          onValueChange={(v) => setOperator(v as AnalyticsFilterOperator)}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS.map((op) => (
              <SelectItem key={op} value={op} className="text-xs">
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <Input
          placeholder={`Search ${DIMENSION_LABELS[dimension].toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Selected values */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {selectedValues.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {v}
              <button
                type="button"
                onClick={() => toggleValue(v)}
                className="hover:opacity-70"
                aria-label={`Remove ${v}`}
              >
                <XIcon className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suggestions list */}
      <div className="max-h-48 overflow-y-auto border-y">
        {optionsState.status === "loading" && (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {optionsState.status === "error" && (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            Could not load suggestions. You can type a value below.
          </div>
        )}
        {optionsState.status === "ready" &&
          optionsState.options.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No matches. Type a value below to add it directly.
            </div>
          )}
        {optionsState.status === "ready" &&
          optionsState.options.map((opt) => {
            const selected = selectedValues.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleValue(opt.value)}
                className={`flex w-full items-center justify-between px-4 py-2 text-xs transition-colors hover:bg-muted ${
                  selected ? "bg-primary/5 font-medium text-primary" : "text-foreground"
                }`}
              >
                <span className="truncate">{opt.label ?? opt.value}</span>
                <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                  {opt.count !== undefined && (
                    <span>{opt.count.toLocaleString()}</span>
                  )}
                  {selected && <span className="text-primary">&#10003;</span>}
                </span>
              </button>
            )
          })}
      </div>

      {/* Manual input */}
      <div className="flex gap-2 p-4 pb-2">
        <Input
          placeholder="Or type a value..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addManual()
            }
          }}
          className="h-8 flex-1 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={addManual}
          disabled={!manualInput.trim()}
        >
          Add
        </Button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t p-4 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Apply filter
        </Button>
      </div>
    </div>
  )
}

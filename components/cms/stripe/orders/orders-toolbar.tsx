"use client"

import { useState, useRef, useEffect, useMemo } from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type {
  OrderView,
  OrderStatus,
  TrackingCarrier,
} from "@/lib/stripe/orders"
import type { CatalogProduct } from "@/lib/stripe/catalog"

export interface OrderFilters {
  status?: OrderStatus
  dateFrom?: string
  dateTo?: string
  totalMin?: number
  totalMax?: number
  carrier?: TrackingCarrier
  hasTracking?: boolean
  hasDispute?: boolean
  isRefunded?: boolean
}

interface OrdersToolbarProps {
  orders: OrderView[]
  catalogProducts: CatalogProduct[]
  filters: OrderFilters
  onFiltersChange: (f: OrderFilters) => void
  search: string
  onSearchChange: (s: string) => void
  sort: string
  onSortChange: (s: string) => void
}

// ---------------------------------------------------------------------------
// Autocomplete helpers
// ---------------------------------------------------------------------------

/** Convert "lower_snake_case" or "camelCase"/"PascalCase" to "Title Case". */
function prettifyMetaKey(key: string): string {
  if (key.includes("_")) {
    return key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

/** Keys that are always present on every PaymentIntent — exclude from meta-autocomplete. */
const UNIVERSAL_META_KEYS = new Set([
  "lines",
  "subtotal",
  "shipping",
  "shipping_source",
  "tracking",
  "tracking_carrier",
  "status_override",
  "shipped_at",
  "outstanding_invoice",
])

type SuggestionType = "product" | "customer" | "meta"

interface Suggestion {
  value: string
  type: SuggestionType
  metaKey?: string
  metaKeyLabel?: string
}

function scoreMatch(value: string, query: string): number {
  const v = value.toLowerCase()
  const q = query.toLowerCase()
  if (v === q) return 4
  if (v.startsWith(q)) return 3
  const words = v.split(/\s+/)
  if (words.some((w) => w.startsWith(q))) return 2
  if (v.includes(q)) return 1
  return 0
}

function buildSuggestions(
  orders: OrderView[],
  catalogProducts: CatalogProduct[],
  query: string
): Suggestion[] {
  if (!query.trim()) return []

  const results: Array<{ suggestion: Suggestion; score: number }> = []
  const seen = new Set<string>()

  function tryAdd(s: Suggestion, score: number) {
    const key = `${s.type}:${s.metaKey ?? ""}:${s.value}`
    if (seen.has(key) || score === 0) return
    seen.add(key)
    results.push({ suggestion: s, score })
  }

  // Product names
  for (const p of catalogProducts) {
    tryAdd({ value: p.name, type: "product" }, scoreMatch(p.name, query))
  }

  // Customer names and emails
  for (const order of orders) {
    if (order.customerName) {
      tryAdd(
        { value: order.customerName, type: "customer" },
        scoreMatch(order.customerName, query)
      )
    }
  }

  // Client-unique metadata (exclude universal keys and id-like keys)
  const metaValues = new Map<string, Set<string>>()
  for (const order of orders) {
    for (const [key, value] of Object.entries(order.rawMetadata)) {
      if (UNIVERSAL_META_KEYS.has(key)) continue
      if (key.toLowerCase().includes("id")) continue
      if (!value) continue
      if (!metaValues.has(key)) metaValues.set(key, new Set())
      metaValues.get(key)!.add(value)
    }
  }
  for (const [key, values] of metaValues) {
    for (const value of values) {
      tryAdd(
        {
          value,
          type: "meta",
          metaKey: key,
          metaKeyLabel: prettifyMetaKey(key),
        },
        scoreMatch(value, query)
      )
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r) => r.suggestion)
}

// ---------------------------------------------------------------------------
// Filter count helper
// ---------------------------------------------------------------------------

function activeFilterCount(f: OrderFilters): number {
  return [
    f.status,
    f.dateFrom,
    f.dateTo,
    f.totalMin,
    f.totalMax,
    f.carrier,
    f.hasTracking !== undefined,
    f.hasDispute !== undefined,
    f.isRefunded !== undefined,
  ].filter(Boolean).length
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrdersToolbar({
  orders,
  catalogProducts,
  filters,
  onFiltersChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: OrdersToolbarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(
    () => buildSuggestions(orders, catalogProducts, search),
    [orders, catalogProducts, search]
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        !searchRef.current?.contains(e.target as Node) &&
        !suggestionsRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filterCount = activeFilterCount(filters)

  function clearAll() {
    onFiltersChange({})
    onSearchChange("")
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-64 flex-1">
        <Input
          ref={searchRef}
          placeholder="Search orders, customers, products…"
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          className="pr-8"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSearchChange(s.value)
                  setShowSuggestions(false)
                }}
              >
                {s.type === "meta" && s.metaKeyLabel && (
                  <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {s.metaKeyLabel}
                  </span>
                )}
                <span className="truncate">{s.value}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground capitalize">
                  {s.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort */}
      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date_desc">Newest first</SelectItem>
          <SelectItem value="date_asc">Oldest first</SelectItem>
          <SelectItem value="shipped_desc">Recently shipped</SelectItem>
          <SelectItem value="total_desc">Total: high to low</SelectItem>
          <SelectItem value="total_asc">Total: low to high</SelectItem>
        </SelectContent>
      </Select>

      {/* Filters popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative gap-2">
            Filters
            {filterCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {filterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-4">
          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={filters.status ?? ""}
              onValueChange={(v) =>
                onFiltersChange({
                  ...filters,
                  status: (v || undefined) as OrderStatus | undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Shipped">Shipped</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="Disputed">Disputed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    dateFrom: e.target.value || undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    dateTo: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Total range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Min total ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={filters.totalMin ?? ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    totalMin: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max total ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={filters.totalMax ?? ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    totalMax: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                placeholder="999.99"
              />
            </div>
          </div>

          {/* Carrier */}
          <div className="space-y-1.5">
            <Label>Carrier</Label>
            <Select
              value={filters.carrier ?? ""}
              onValueChange={(v) =>
                onFiltersChange({
                  ...filters,
                  carrier: (v || undefined) as TrackingCarrier | undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="USPS">USPS</SelectItem>
                <SelectItem value="UPS">UPS</SelectItem>
                <SelectItem value="FEDEX">FedEx</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Boolean toggles */}
          <div className="space-y-2">
            <Label>Other</Label>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ["Has tracking", "hasTracking"],
                  ["No tracking", "noTracking"],
                  ["Has dispute", "hasDispute"],
                  ["Refunded", "isRefunded"],
                ] as const
              ).map(([label, key]) => {
                const flag =
                  key === "noTracking"
                    ? filters.hasTracking === false
                    : key === "hasTracking"
                      ? filters.hasTracking === true
                      : key === "hasDispute"
                        ? filters.hasDispute === true
                        : filters.isRefunded === true

                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "hasTracking")
                        onFiltersChange({
                          ...filters,
                          hasTracking: flag ? undefined : true,
                        })
                      else if (key === "noTracking")
                        onFiltersChange({
                          ...filters,
                          hasTracking: flag ? undefined : false,
                        })
                      else if (key === "hasDispute")
                        onFiltersChange({
                          ...filters,
                          hasDispute: flag ? undefined : true,
                        })
                      else
                        onFiltersChange({
                          ...filters,
                          isRefunded: flag ? undefined : true,
                        })
                    }}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      flag
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {filterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onFiltersChange({})}
            >
              Clear filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {(filterCount > 0 || search) && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear all
        </Button>
      )}
    </div>
  )
}

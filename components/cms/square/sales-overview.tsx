"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CalendarIcon,
  FilterIcon,
  Loader2Icon,
  PackageIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { SquareOrderContextMenu } from "@/components/cms/square/order-actions"
import { SquareProductContextMenu } from "@/components/cms/square/product-actions"
import type { DashboardSummary, KmOrderState } from "@/lib/square/types"
import { cn } from "@/lib/utils"

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLOR_CURRENT = "var(--primary)"
const COLOR_PREV = "oklch(65% 0.04 220)"

const PIE_COLORS: Record<string, string> = {
  // fulfillment
  shipment: "oklch(68% 0.16 220)",
  pickup: "oklch(68% 0.16 145)",
  other: "oklch(60% 0.05 220)",
  // status
  COMPLETED: "oklch(68% 0.16 145)",
  IN_PROGRESS: "oklch(68% 0.16 220)",
  OPEN: "oklch(72% 0.14 85)",
  CANCELED: "oklch(55% 0.18 25)",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtShort(cents: number): string {
  const v = cents / 100
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%"
  return `${Math.round((part / total) * 100)}%`
}

const STATE_LABELS: Record<KmOrderState, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  ABANDONED_CHECKOUT: "Abandoned",
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

type Preset = "7d" | "30d" | "90d" | "6m" | "12m" | "custom"

function presetRange(preset: Preset): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (preset === "7d") from.setDate(to.getDate() - 7)
  else if (preset === "30d") from.setDate(to.getDate() - 30)
  else if (preset === "90d") from.setDate(to.getDate() - 90)
  else if (preset === "6m") from.setMonth(to.getMonth() - 6)
  else if (preset === "12m") from.setFullYear(to.getFullYear() - 1)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

/** Auto-select granularity based on the selected date window (mirrors KMCMS getChartGranularity). */
function autoGranularity(from: string, to: string): "day" | "week" | "month" {
  const diffMs = new Date(to).getTime() - new Date(from).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays <= 30) return "day"
  if (diffDays <= 90) return "week"
  return "month"
}

function getPrevPeriodDates(currentFrom: string, currentTo: string) {
  try {
    const from = new Date(currentFrom)
    const to = new Date(currentTo + "T23:59:59Z")
    const durationMs = to.getTime() - from.getTime()
    const prevTo = new Date(from.getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - durationMs)
    return {
      from: prevFrom.toISOString().slice(0, 10),
      to: prevTo.toISOString().slice(0, 10),
    }
  } catch {
    return null
  }
}

// ─── Delta calculation ────────────────────────────────────────────────────────

interface Delta {
  pct: number
  abs: number
  up: boolean
}

function calcDelta(current: number, prev: number): Delta | null {
  if (!prev) return null
  const p = ((current - prev) / Math.abs(prev)) * 100
  return { pct: p, abs: current - prev, up: p >= 0 }
}

// ─── KPI card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  delta?: Delta | null
  deltaAsMoney?: boolean
}
function KpiCard({
  label,
  value,
  sub,
  icon,
  delta,
  deltaAsMoney,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {delta ? (
          <div
            className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta.up ? "text-emerald-500" : "text-destructive"}`}
          >
            {delta.up ? (
              <ArrowUpIcon className="size-3" />
            ) : (
              <ArrowDownIcon className="size-3" />
            )}
            <span>
              {deltaAsMoney
                ? `${fmt(Math.abs(delta.abs))} vs last period`
                : `${Math.abs(delta.pct).toFixed(1)}% vs last period`}
            </span>
          </div>
        ) : (
          sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Bar row ──────────────────────────────────────────────────────────────────

function BarRow({
  label,
  value,
  total,
  displayValue,
}: {
  label: string
  value: number
  total: number
  displayValue: string
}) {
  const width = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="max-w-[60%] truncate">{label}</span>
        <span className="font-medium tabular-nums">{displayValue}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ─── Donut pie ────────────────────────────────────────────────────────────────

interface PieSlice {
  name: string
  value: number
  color: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p style={{ color: p.payload.color }}>
        {p.name}: {p.value}
      </p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function DonutChart({ slices, total }: { slices: PieSlice[]; total: number }) {
  const nonZero = slices.filter((s) => s.value > 0)
  if (nonZero.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No data.</p>
    )
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={nonZero}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={88}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {nonZero.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-muted-foreground">orders</span>
        </div>
      </div>
      {/* Legend */}
      <div className="w-full space-y-1.5">
        {nonZero.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-muted-foreground">{s.name}</span>
            </div>
            <span className="font-medium tabular-nums">
              {s.value}{" "}
              <span className="text-xs text-muted-foreground">
                ({pct(s.value, total)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Chart tooltips ───────────────────────────────────────────────────────────

/** Given "2026-W27" returns the Monday–Sunday range, e.g. "Jun 29 – Jul 5". */
function isoWeekDateRange(weekStr: string): string | null {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1])
  const week = parseInt(match[2])
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() // 0=Sun … 6=Sat
  const mondayW1 = new Date(jan4)
  mondayW1.setUTCDate(jan4.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  const monday = new Date(mondayW1)
  monday.setUTCDate(mondayW1.getUTCDate() + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const f = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  return `${f(monday)} – ${f(sunday)}`
}

/** Given "2026-06" returns "Jun 2026". */
function monthLabel(monthStr: string): string | null {
  const match = monthStr.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const d = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, 1))
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, isRevenue }: any) {
  if (!active || !payload?.length) return null
  const sub = isoWeekDateRange(label as string) ?? monthLabel(label as string)
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      {sub && <p className="mb-1 text-xs text-muted-foreground">{sub}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          <span className="mr-1 text-xs text-muted-foreground">{p.name}:</span>
          {isRevenue ? fmt(p.value ?? 0) : (p.value ?? 0)}
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type OrdersBreakdown = "fulfillment" | "status"

interface ChartPoint {
  label: string
  current: number
  previous?: number
  ordCurrent: number
  ordPrevious?: number
}

export function SalesOverview() {
  // ── Filter state ──
  const [preset, setPreset] = useState<Preset>("30d")
  const [dateFrom, setDateFrom] = useState(() => presetRange("30d").from)
  const [dateTo, setDateTo] = useState(() => presetRange("30d").to)
  const [status, setStatus] = useState("ALL")
  const [fulfillment, setFulfillment] = useState("ALL")
  const [productName, setProductName] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [compareEnabled, setCompareEnabled] = useState(false)

  // ── View state ──
  const [ordersBreakdown, setOrdersBreakdown] =
    useState<OrdersBreakdown>("fulfillment")
  // Auto granularity tracks the date range; user can override
  const [granularity, setGranularity] = useState<"day" | "week" | "month">(() =>
    autoGranularity(presetRange("30d").from, presetRange("30d").to)
  )

  // ── Data state ──
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [prevSummary, setPrevSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildParams = useCallback(
    (from: string, to: string) => {
      const p = new URLSearchParams({ from, to, status, fulfillment })
      if (productName) p.set("product", productName)
      if (categoryName) p.set("category", categoryName)
      if (minAmount) p.set("min", minAmount)
      if (maxAmount) p.set("max", maxAmount)
      return p
    },
    [status, fulfillment, productName, categoryName, minAmount, maxAmount]
  )

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const prevDates = compareEnabled
        ? getPrevPeriodDates(dateFrom, dateTo)
        : null

      const [res, prevRes] = await Promise.all([
        fetch(`/api/square/analytics?${buildParams(dateFrom, dateTo)}`),
        prevDates
          ? fetch(
              `/api/square/analytics?${buildParams(prevDates.from, prevDates.to)}`
            )
          : Promise.resolve(null),
      ])

      if (!res.ok) throw new Error("Failed to load")
      const data = (await res.json()) as DashboardSummary
      setSummary(data)

      if (prevRes?.ok) {
        setPrevSummary((await prevRes.json()) as DashboardSummary)
      } else {
        setPrevSummary(null)
      }
    } catch {
      setError("Could not load analytics data.")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, compareEnabled, buildParams])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  function applyPreset(p: Preset) {
    setPreset(p)
    if (p !== "custom") {
      const r = presetRange(p)
      setDateFrom(r.from)
      setDateTo(r.to)
      setGranularity(autoGranularity(r.from, r.to))
    }
  }

  // ── Chart data ──
  const chartData: ChartPoint[] = (() => {
    if (!summary) return []
    type SeriesTouple = { label: string; value: number }
    let curr: SeriesTouple[] = []
    let prev: { value: number }[] = []

    // Revenue
    const revRows = {
      day: summary.revenue_by_day.map((r) => ({
        label: r.date,
        value: r.revenue,
      })),
      week: summary.revenue_by_week.map((r) => ({
        label: r.week,
        value: r.revenue,
      })),
      month: summary.revenue_by_month.map((r) => ({
        label: r.month,
        value: r.revenue,
      })),
    }
    const ordRows = {
      day: summary.orders_by_day.map((r) => ({
        label: r.date,
        value: r.count,
      })),
      week: summary.orders_by_week.map((r) => ({
        label: r.week,
        value: r.count,
      })),
      month: summary.orders_by_month.map((r) => ({
        label: r.month,
        value: r.count,
      })),
    }
    curr = revRows[granularity]
    if (compareEnabled && prevSummary) {
      prev = {
        day: prevSummary.revenue_by_day.map((r) => ({ value: r.revenue })),
        week: prevSummary.revenue_by_week.map((r) => ({ value: r.revenue })),
        month: prevSummary.revenue_by_month.map((r) => ({ value: r.revenue })),
      }[granularity]
    }

    const prevOrdCounts: number[] =
      compareEnabled && prevSummary
        ? {
            day: prevSummary.orders_by_day.map((r) => r.count),
            week: prevSummary.orders_by_week.map((r) => r.count),
            month: prevSummary.orders_by_month.map((r) => r.count),
          }[granularity]
        : []

    return curr.map((pt, i) => ({
      label: pt.label,
      current: pt.value,
      ...(compareEnabled && prev[i] !== undefined
        ? { previous: prev[i].value }
        : {}),
      ordCurrent: ordRows[granularity][i]?.value ?? 0,
      ...(compareEnabled && prevOrdCounts[i] !== undefined
        ? { ordPrevious: prevOrdCounts[i] }
        : {}),
    }))
  })()

  // ── Pie slices ──
  const pieSlices: PieSlice[] = (() => {
    if (!summary) return []
    if (ordersBreakdown === "fulfillment") {
      const f = summary.orders_by_fulfillment
      return [
        { name: "Shipment", value: f.shipment, color: PIE_COLORS.shipment },
        { name: "Pickup", value: f.pickup, color: PIE_COLORS.pickup },
        { name: "Other", value: f.other, color: PIE_COLORS.other },
      ]
    }
    const s = summary.orders_by_state
    return [
      { name: "Completed", value: s.COMPLETED, color: PIE_COLORS.COMPLETED },
      {
        name: "In Progress",
        value: s.IN_PROGRESS,
        color: PIE_COLORS.IN_PROGRESS,
      },
      { name: "Open", value: s.OPEN, color: PIE_COLORS.OPEN },
      { name: "Canceled", value: s.CANCELED, color: PIE_COLORS.CANCELED },
    ]
  })()

  const pieTotal = pieSlices.reduce((s, p) => s + p.value, 0)

  const activeFilters = [
    status !== "ALL",
    fulfillment !== "ALL",
    !!productName,
    !!categoryName,
    !!minAmount,
    !!maxAmount,
  ].filter(Boolean).length

  // ── KPI deltas ──
  const revDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.total_revenue ?? 0, prevSummary.total_revenue)
      : null
  const orderDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.order_count ?? 0, prevSummary.order_count)
      : null
  const aovDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.avg_order_value ?? 0, prevSummary.avg_order_value)
      : null
  const taxDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.total_sales_tax ?? 0, prevSummary.total_sales_tax)
      : null

  const prevDatesLabel = (() => {
    if (!compareEnabled) return null
    const d = getPrevPeriodDates(dateFrom, dateTo)
    return d ? `vs ${d.from} – ${d.to}` : null
  })()

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary
              ? `${summary.date_from} – ${summary.date_to}`
              : "Revenue and order analytics from Square."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Compare checkbox */}
          <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
            <Checkbox
              checked={compareEnabled}
              onCheckedChange={(v) => setCompareEnabled(!!v)}
            />
            <span className="text-muted-foreground">
              Compare to last period
            </span>
            {prevDatesLabel && (
              <span className="text-xs text-muted-foreground/60">
                ({prevDatesLabel})
              </span>
            )}
          </label>

          {/* Presets */}
          <div className="flex rounded-lg border">
            {(["7d", "30d", "90d", "6m", "12m"] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                  preset === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "12m" ? "1Y" : p.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={preset === "custom" ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
              >
                <CalendarIcon className="size-3.5" />
                {preset === "custom"
                  ? `${dateFrom} → ${dateTo}`
                  : "Custom range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setPreset("custom")
                      setGranularity(autoGranularity(e.target.value, dateTo))
                    }}
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setPreset("custom")
                      setGranularity(autoGranularity(dateFrom, e.target.value))
                    }}
                    className="mt-1 h-8"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <FilterIcon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Filters
        </span>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-36 bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELED">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={fulfillment} onValueChange={setFulfillment}>
          <SelectTrigger className="h-8 w-36 bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All fulfillment</SelectItem>
            <SelectItem value="PICKUP">Pickup</SelectItem>
            <SelectItem value="SHIPMENT">Shipment</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Product name…"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="h-8 w-36 bg-background text-xs"
        />
        <Input
          placeholder="Category…"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          className="h-8 w-32 bg-background text-xs"
        />

        <div className="flex items-center gap-1">
          <Input
            placeholder="Min $"
            value={minAmount}
            type="number"
            min={0}
            onChange={(e) => setMinAmount(e.target.value)}
            className="h-8 w-20 bg-background text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            placeholder="Max $"
            value={maxAmount}
            type="number"
            min={0}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="h-8 w-20 bg-background text-xs"
          />
        </div>

        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setStatus("ALL")
              setFulfillment("ALL")
              setProductName("")
              setCategoryName("")
              setMinAmount("")
              setMaxAmount("")
            }}
          >
            Clear ({activeFilters})
          </Button>
        )}
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && !loading && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {summary && !loading && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total revenue"
              value={fmt(summary.total_revenue)}
              sub={`${summary.order_count} orders`}
              icon={<TrendingUpIcon className="size-4" />}
              delta={revDelta}
              deltaAsMoney
            />
            <KpiCard
              label="Orders"
              value={String(summary.order_count)}
              sub={`${summary.orders_by_state.COMPLETED} completed`}
              icon={<ShoppingBagIcon className="size-4" />}
              delta={orderDelta}
            />
            <KpiCard
              label="Avg order value"
              value={fmt(summary.avg_order_value)}
              sub="completed orders only"
              icon={<ReceiptIcon className="size-4" />}
              delta={aovDelta}
              deltaAsMoney
            />
            <KpiCard
              label="Sales tax collected"
              value={fmt(summary.total_sales_tax)}
              icon={<PackageIcon className="size-4" />}
              delta={taxDelta}
              deltaAsMoney
            />
          </div>

          {/* ── Revenue chart ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm">Revenue</CardTitle>
                  {compareEnabled && prevSummary && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ background: COLOR_CURRENT }}
                        />
                        Current
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 rounded-full border-2"
                          style={{
                            borderColor: COLOR_PREV,
                            background: "transparent",
                          }}
                        />
                        Prior period
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex rounded-lg border">
                  {(["day", "week", "month"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGranularity(g)}
                      className={`px-3 py-1 text-xs font-medium capitalize transition-colors first:rounded-l-md last:rounded-r-md ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No data for selected range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="revGradCurr"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={COLOR_CURRENT}
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="100%"
                          stopColor={COLOR_CURRENT}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                      <linearGradient
                        id="revGradPrev"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={COLOR_PREV}
                          stopOpacity={0.12}
                        />
                        <stop
                          offset="100%"
                          stopColor={COLOR_PREV}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/50"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={fmtShort}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip content={<ChartTooltip isRevenue />} />
                    {compareEnabled && prevSummary && (
                      <Area
                        type="monotone"
                        dataKey="previous"
                        name="Prior period"
                        stroke={COLOR_PREV}
                        strokeWidth={1.5}
                        strokeOpacity={0.7}
                        strokeDasharray="4 2"
                        fill="url(#revGradPrev)"
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="current"
                      name="Current"
                      stroke={COLOR_CURRENT}
                      strokeWidth={2}
                      strokeOpacity={1}
                      fill="url(#revGradCurr)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Orders chart ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm">Orders</CardTitle>
                  {compareEnabled && prevSummary && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ background: COLOR_CURRENT }}
                        />
                        Current
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ background: COLOR_PREV, opacity: 0.7 }}
                        />
                        Prior period
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex rounded-lg border">
                  {(["day", "week", "month"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGranularity(g)}
                      className={`px-3 py-1 text-xs font-medium capitalize transition-colors first:rounded-l-md last:rounded-r-md ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No data for selected range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                    barGap={2}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/50"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip content={<ChartTooltip isRevenue={false} />} />
                    {compareEnabled && prevSummary && (
                      <Bar
                        dataKey="ordPrevious"
                        name="Prior period"
                        fill={COLOR_PREV}
                        fillOpacity={0.55}
                        radius={[2, 2, 0, 0]}
                      />
                    )}
                    <Bar
                      dataKey="ordCurrent"
                      name="Current"
                      fill={COLOR_CURRENT}
                      fillOpacity={0.9}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Orders by (Pie) + Top Products ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Orders by Donut */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Orders by</CardTitle>
                <Select
                  value={ordersBreakdown}
                  onValueChange={(v) =>
                    setOrdersBreakdown(v as OrdersBreakdown)
                  }
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fulfillment">Fulfillment</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <DonutChart slices={pieSlices} total={pieTotal} />
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Top products by revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.top_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No completed orders in range.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {summary.top_products.map((p, i) => (
                      <SquareProductContextMenu
                        key={p.id}
                        product={{ id: p.id, name: p.name }}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-between rounded-md px-1 py-0.5 text-sm",
                            entityContextTargetClass
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}
                            >
                              {i + 1}
                            </span>
                            <span className="truncate">{p.name}</span>
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-xs"
                            >
                              {p.quantity}x
                            </Badge>
                          </div>
                          <span className="ml-3 shrink-0 font-medium tabular-nums">
                            {fmt(p.revenue)}
                          </span>
                        </div>
                      </SquareProductContextMenu>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Best Selling Options (variations + option values side by side) ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Best Selling Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Top variations */}
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Top Variations
                  </p>
                  {summary.top_variations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data.</p>
                  ) : (
                    <div className="space-y-2">
                      {summary.top_variations.slice(0, 8).map((v, i) => (
                        <div
                          key={v.name}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {i === 0 ? (
                              <Badge className="shrink-0 px-1.5 text-xs">
                                #1
                              </Badge>
                            ) : (
                              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                                {i + 1}
                              </span>
                            )}
                            <span className="truncate">{v.name}</span>
                          </div>
                          <div className="ml-2 flex shrink-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {v.quantity}x
                            </span>
                            <span className="font-medium tabular-nums">
                              {fmt(v.revenue)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top option values */}
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Top Option Values
                  </p>
                  {summary.top_option_values.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data.</p>
                  ) : (
                    <div className="space-y-2">
                      {summary.top_option_values.slice(0, 10).map((ov, i) => {
                        const maxQty =
                          summary.top_option_values[0]?.quantity ?? 1
                        return (
                          <div key={ov.value} className="space-y-0.5">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                {i === 0 ? (
                                  <Badge className="shrink-0 px-1.5 text-xs">
                                    #1
                                  </Badge>
                                ) : (
                                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                                    {i + 1}
                                  </span>
                                )}
                                <span className="truncate">{ov.value}</span>
                              </div>
                              <span className="ml-2 shrink-0 font-medium tabular-nums">
                                {ov.quantity}x
                              </span>
                            </div>
                            <div className="ml-7 h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/50"
                                style={{
                                  width: `${(ov.quantity / maxQty) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Recent orders ── */}
          {summary.recent_orders.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Recent orders</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  asChild
                >
                  <Link href="/square/orders">
                    View all <ArrowRightIcon className="size-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.recent_orders.map((o) => (
                    <SquareOrderContextMenu key={o.id} order={o}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-md px-1 py-0.5 text-sm",
                          entityContextTargetClass
                        )}
                      >
                        <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                          {o.id.slice(-8)}
                        </span>
                        <Badge
                          variant={
                            o.km_state === "COMPLETED"
                              ? "default"
                              : o.km_state === "CANCELED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="shrink-0"
                        >
                          {STATE_LABELS[o.km_state] ?? o.km_state}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate">
                          {o.product_name}
                          {o.extra_items > 0 && (
                            <span className="ml-1 text-muted-foreground">
                              +{o.extra_items}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString()}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {fmt(o.total_money.amount)}
                        </span>
                      </div>
                    </SquareOrderContextMenu>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

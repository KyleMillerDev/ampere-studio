"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  Loader2Icon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { RecentSubmissionsPanel } from "@/components/cms/recent-submissions-panel"
import { FailedPaymentRow } from "@/components/cms/stripe/failed-payment-row"
import { RecentOrderRow } from "@/components/cms/stripe/recent-order-row"
import { StripeProductContextMenu } from "@/components/cms/stripe/product-actions"
import { StripeBalanceSummary } from "@/components/cms/stripe/stripe-balance-summary"
import { cn } from "@/lib/utils"
import type { Submission } from "@/lib/cms/submission-types"
import type { StripeDashboardSummary } from "@/lib/stripe/analytics"
import type { OrderStatus } from "@/lib/stripe/order-model"

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLOR_CURRENT = "var(--primary)"
const COLOR_PREV = "oklch(65% 0.04 220)"

/**
 * Chart colors keep the same hue families as status badges, but use softer
 * oklch values that sit with the app's teal/cyan primary and muted surfaces.
 */
const STATUS_COLORS: Record<OrderStatus, string> = {
  Paid: "oklch(0.62 0.13 245)",
  Shipped: "oklch(0.72 0.13 75)",
  Complete: "oklch(0.66 0.13 155)",
  Cancelled: "oklch(0.58 0.03 220)",
  Refunded: "oklch(0.52 0.035 230)",
  "Partially Refunded": "oklch(0.68 0.14 48)",
  Disputed: "oklch(0.58 0.17 25)",
  Failed: "oklch(0.58 0.17 25)",
  Abandoned: "oklch(0.55 0.02 260)",
  "Checking out": "oklch(0.65 0.1 230)",
}

const PAYMENT_STATUS_ORDER: OrderStatus[] = [
  "Complete",
  "Paid",
  "Shipped",
  "Partially Refunded",
  "Refunded",
  "Failed",
  "Disputed",
  "Cancelled",
]

const PRESET_LABELS: Record<Preset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last year",
  custom: "Custom",
}

// ─── Formatters ──────────────────────────────────────────────────────────────

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

function hourLabel(hour: number): string {
  if (hour === 0) return "12:00 AM"
  if (hour === 12) return "12:00 PM"
  if (hour < 12) return `${hour}:00 AM`
  return `${hour - 12}:00 PM`
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

function autoGranularity(from: string, to: string): "day" | "week" | "month" {
  const diffDays =
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
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

// ─── Delta ───────────────────────────────────────────────────────────────────

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

// ─── Tooltip helpers ─────────────────────────────────────────────────────────

function isoWeekDateRange(weekStr: string): string | null {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1]),
    week = parseInt(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay()
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

function monthLabel(s: string): string | null {
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString("en-US", {
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
        <p key={p.dataKey} style={{ color: p.color ?? COLOR_CURRENT }}>
          <span className="mr-1 text-xs text-muted-foreground">{p.name}:</span>
          {isRevenue ? fmt(p.value ?? 0) : (p.value ?? 0)}
        </p>
      ))}
    </div>
  )
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
function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
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

interface ChartPoint {
  label: string
  current: number
  previous?: number
  ordCurrent: number
  ordPrevious?: number
  netCurrent: number
  netPrevious?: number
}

function DeltaLine({
  delta,
  asMoney,
}: {
  delta: Delta | null
  asMoney?: boolean
}) {
  if (!delta) return null
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta.up ? "text-emerald-500" : "text-destructive"}`}
    >
      {delta.up ? (
        <ArrowUpIcon className="size-3" />
      ) : (
        <ArrowDownIcon className="size-3" />
      )}
      <span>
        {asMoney
          ? `${fmt(Math.abs(delta.abs))} vs last period`
          : `${Math.abs(delta.pct).toFixed(1)}% vs last period`}
      </span>
    </div>
  )
}

function OverviewCardFooter({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
      <span>Updated just now</span>
      <Link href={href} className="font-medium hover:text-foreground">
        {label}
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StripeSalesOverviewProps {
  recentSubmissions?: Submission[]
}

export function StripeSalesOverview({
  recentSubmissions = [],
}: StripeSalesOverviewProps) {
  const [preset, setPreset] = useState<Preset>("7d")
  const [dateFrom, setDateFrom] = useState(() => presetRange("7d").from)
  const [dateTo, setDateTo] = useState(() => presetRange("7d").to)
  const [status, setStatus] = useState("ALL")
  const [productName, setProductName] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [compareEnabled, setCompareEnabled] = useState(true)

  const [granularity, setGranularity] = useState<"day" | "week" | "month">(() =>
    autoGranularity(presetRange("7d").from, presetRange("7d").to)
  )
  const [topProductsSort, setTopProductsSort] = useState<
    "revenue" | "quantity"
  >("revenue")

  const [summary, setSummary] = useState<StripeDashboardSummary | null>(null)
  const [prevSummary, setPrevSummary] = useState<StripeDashboardSummary | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildParams = useCallback(
    (from: string, to: string) => {
      const p = new URLSearchParams({ from, to, status })
      if (productName) p.set("product", productName)
      if (minAmount) p.set("min", minAmount)
      if (maxAmount) p.set("max", maxAmount)
      return p
    },
    [status, productName, minAmount, maxAmount]
  )

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const prevDates = compareEnabled
        ? getPrevPeriodDates(dateFrom, dateTo)
        : null
      const [res, prevRes] = await Promise.all([
        fetch(`/api/stripe/analytics?${buildParams(dateFrom, dateTo)}`),
        prevDates
          ? fetch(
              `/api/stripe/analytics?${buildParams(prevDates.from, prevDates.to)}`
            )
          : Promise.resolve(null),
      ])
      if (!res.ok) throw new Error("Failed to load")
      setSummary((await res.json()) as StripeDashboardSummary)
      setPrevSummary(
        prevRes?.ok ? ((await prevRes.json()) as StripeDashboardSummary) : null
      )
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

  const chartData: ChartPoint[] = useMemo(() => {
    if (!summary) return []
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
    const netRows = {
      day: summary.net_revenue_by_day.map((r) => ({
        label: r.date,
        value: r.revenue,
      })),
      week: summary.net_revenue_by_week.map((r) => ({
        label: r.week,
        value: r.revenue,
      })),
      month: summary.net_revenue_by_month.map((r) => ({
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
    const curr = revRows[granularity]
    const prev =
      compareEnabled && prevSummary
        ? {
            day: prevSummary.revenue_by_day.map((r) => r.revenue),
            week: prevSummary.revenue_by_week.map((r) => r.revenue),
            month: prevSummary.revenue_by_month.map((r) => r.revenue),
          }[granularity]
        : []
    const prevNet =
      compareEnabled && prevSummary
        ? {
            day: prevSummary.net_revenue_by_day.map((r) => r.revenue),
            week: prevSummary.net_revenue_by_week.map((r) => r.revenue),
            month: prevSummary.net_revenue_by_month.map((r) => r.revenue),
          }[granularity]
        : []
    const prevOrd =
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
      ...(prev[i] !== undefined ? { previous: prev[i] } : {}),
      ordCurrent: ordRows[granularity][i]?.value ?? 0,
      ...(prevOrd[i] !== undefined ? { ordPrevious: prevOrd[i] } : {}),
      netCurrent: netRows[granularity][i]?.value ?? 0,
      ...(prevNet[i] !== undefined ? { netPrevious: prevNet[i] } : {}),
    }))
  }, [summary, prevSummary, compareEnabled, granularity])

  const pieSlices = summary
    ? (Object.entries(summary.orders_by_status) as [OrderStatus, number][])
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] }))
    : []
  const pieTotal = pieSlices.reduce((s, p) => s + p.value, 0)

  const topProducts = useMemo(() => {
    if (!summary) return []
    const products = [...summary.top_products]
    if (topProductsSort === "quantity") {
      products.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    } else {
      products.sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    }
    return products.slice(0, 10)
  }, [summary, topProductsSort])

  const revDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.total_revenue ?? 0, prevSummary.total_revenue)
      : null
  const netDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.net_revenue ?? 0, prevSummary.net_revenue)
      : null
  const orderDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.order_count ?? 0, prevSummary.order_count)
      : null
  const aovDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.avg_order_value ?? 0, prevSummary.avg_order_value)
      : null
  const customersDelta =
    compareEnabled && prevSummary
      ? calcDelta(summary?.new_customers ?? 0, prevSummary.new_customers)
      : null

  const activeFilters = [
    status !== "ALL",
    !!productName,
    !!minAmount,
    !!maxAmount,
  ].filter(Boolean).length

  const prevDatesLabel = (() => {
    if (!compareEnabled) return null
    const d = getPrevPeriodDates(dateFrom, dateTo)
    return d ? `vs ${d.from} – ${d.to}` : null
  })()

  const paymentRows = summary
    ? PAYMENT_STATUS_ORDER.map((name) => ({
        name,
        amount: summary.revenue_by_status[name],
        count: summary.orders_by_status[name],
        color: STATUS_COLORS[name],
      })).filter((r) => r.amount > 0 || r.count > 0)
    : []

  const todayChart = summary?.today.by_hour.map((h) => ({
    label: hourLabel(h.hour),
    today: h.today,
    yesterday: h.yesterday,
  }))

  return (
    <div className="space-y-8">
      {/* ── Today ── */}
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="space-y-4">
            {summary && !loading ? (
              <>
                <div className="flex flex-wrap gap-10">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Gross volume
                    </p>
                    <p className="text-2xl font-semibold tracking-tight">
                      {fmt(summary.today.gross_volume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Yesterday</p>
                    <p className="text-2xl font-semibold tracking-tight text-muted-foreground">
                      {fmt(summary.today.yesterday_gross_volume)}
                    </p>
                  </div>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={todayChart}
                      margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border/40"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval={5}
                      />
                      <YAxis
                        tickFormatter={fmtShort}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                      />
                      <RechartsTooltip content={<ChartTooltip isRevenue />} />
                      <Line
                        type="monotone"
                        dataKey="yesterday"
                        name="Yesterday"
                        stroke={COLOR_PREV}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="today"
                        name="Today"
                        stroke={COLOR_CURRENT}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            <StripeBalanceSummary />
          </div>

          <RecentSubmissionsPanel
            submissions={recentSubmissions}
            className="hidden lg:block"
          />
        </div>
      </section>

      {/* ── Your overview ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Your overview
            </h2>
            {summary && (
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.date_from} – {summary.date_to}
                {compareEnabled && prevDatesLabel && (
                  <span className="ml-2 text-muted-foreground/60">
                    Compare ({prevDatesLabel})
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date range — Stripe-style combined pill */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 gap-0 px-3 text-sm font-normal"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    Date range
                  </span>
                  <span className="mx-2 h-3 w-px bg-border" />
                  <span className="font-medium">{PRESET_LABELS[preset]}</span>
                  <ChevronDownIcon className="ml-1.5 size-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="flex">
                  <div className="w-40 border-r py-1.5">
                    {(["7d", "30d", "90d", "6m", "12m"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => applyPreset(p)}
                        className={`flex w-full items-center justify-between px-4 py-1.5 text-sm transition-colors hover:bg-muted ${preset === p ? "font-medium text-primary" : "text-foreground"}`}
                      >
                        {PRESET_LABELS[p]}
                        {preset === p && (
                          <CheckIcon className="size-3.5 text-primary" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setPreset("custom")}
                      className={`flex w-full items-center justify-between px-4 py-1.5 text-sm transition-colors hover:bg-muted ${preset === "custom" ? "font-medium text-primary" : "text-foreground"}`}
                    >
                      Custom
                      {preset === "custom" && (
                        <CheckIcon className="size-3.5 text-primary" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 space-y-3 p-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Start
                      </Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value)
                          setPreset("custom")
                        }}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        End
                      </Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value)
                          setPreset("custom")
                        }}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Granularity dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 text-sm font-normal"
                >
                  {granularity === "day"
                    ? "Daily"
                    : granularity === "week"
                      ? "Weekly"
                      : "Monthly"}
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="end">
                {(["day", "week", "month"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`flex w-full items-center justify-between rounded-sm px-3 py-1.5 text-sm transition-colors hover:bg-muted ${granularity === g ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {g === "day"
                      ? "Daily"
                      : g === "week"
                        ? "Weekly"
                        : "Monthly"}
                    {granularity === g && <CheckIcon className="size-3.5" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Compare — Stripe-style: [×] Compare | Previous period */}
            <div className="flex h-9 items-center overflow-hidden rounded-md border bg-background text-sm">
              <button
                onClick={() => setCompareEnabled(!compareEnabled)}
                className="flex h-full items-center gap-1.5 px-3 transition-colors hover:bg-muted/60"
              >
                {compareEnabled ? (
                  <XIcon className="size-3.5 text-muted-foreground" />
                ) : null}
                <span
                  className={
                    compareEnabled ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  Compare
                </span>
              </button>
              {compareEnabled && (
                <>
                  <span className="h-4 w-px bg-border" />
                  <span className="flex h-full items-center px-3 text-sm text-muted-foreground">
                    Previous period
                  </span>
                </>
              )}
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => void fetchSummary()}
              title="Refresh"
            >
              <RefreshCwIcon
                className={`size-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

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
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Shipped">Shipped</SelectItem>
              <SelectItem value="Complete">Complete</SelectItem>
              <SelectItem value="Partially Refunded">
                Partially Refunded
              </SelectItem>
              <SelectItem value="Refunded">Refunded</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Disputed">Disputed</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Product name…"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="h-8 w-40 bg-background text-xs"
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
                setProductName("")
                setMinAmount("")
                setMaxAmount("")
              }}
            >
              Clear ({activeFilters})
            </Button>
          )}
        </div>

        {error && !loading && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading && !summary && (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {summary && (
          <>
            {summary.total_refunded > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Refunds issued:
                </span>
                <span className="text-amber-700 dark:text-amber-400">
                  {fmt(summary.total_refunded)}
                </span>
              </div>
            )}

            {/* Stripe-style overview cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {/* Payments */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <TooltipProvider delayDuration={100}>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                      {paymentRows.map((r) => {
                        if (r.amount <= 0) return null
                        return (
                          <Tooltip key={r.name}>
                            <TooltipTrigger asChild>
                              <div
                                className="h-full min-w-1 cursor-default transition-opacity hover:opacity-90"
                                style={{
                                  flexGrow: r.amount,
                                  flexBasis: 0,
                                  background: r.color,
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={6}>
                              {fmt(r.amount)} in {r.name} payments
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </TooltipProvider>
                  <div className="overflow-hidden rounded-lg border">
                    {paymentRows.length === 0 ? (
                      <p className="px-3 py-2.5 text-sm text-muted-foreground">
                        No payments in range.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {paymentRows.map((r) => (
                          <li
                            key={r.name}
                            className="flex items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ background: r.color }}
                              />
                              <span className="text-muted-foreground">
                                {r.name}
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {fmt(r.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <OverviewCardFooter href="/orders" label="View all" />
                </CardContent>
              </Card>

              {/* Gross volume */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Gross volume
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-2xl font-semibold tracking-tight">
                    {fmt(summary.total_revenue)}
                  </p>
                  {compareEnabled && prevSummary ? (
                    <p className="text-xs text-muted-foreground">
                      {fmt(prevSummary.total_revenue)} previous period
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {summary.order_count} orders
                    </p>
                  )}
                  <DeltaLine delta={revDelta} asMoney />
                  <div className="mt-1 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={["dataMin", "dataMax"]} />
                        <RechartsTooltip content={<ChartTooltip isRevenue />} />
                        {compareEnabled && prevSummary && (
                          <Line
                            type="monotone"
                            dataKey="previous"
                            name="Prior"
                            stroke={COLOR_PREV}
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            dot={false}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="current"
                          name="Gross"
                          stroke={COLOR_CURRENT}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <OverviewCardFooter href="/orders" label="More details" />
                </CardContent>
              </Card>

              {/* Net volume */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Net volume
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-2xl font-semibold tracking-tight">
                    {fmt(summary.net_revenue)}
                  </p>
                  {compareEnabled && prevSummary ? (
                    <p className="text-xs text-muted-foreground">
                      {fmt(prevSummary.net_revenue)} previous period
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      after refunds
                    </p>
                  )}
                  <DeltaLine delta={netDelta} asMoney />
                  <div className="mt-1 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={["dataMin", "dataMax"]} />
                        <RechartsTooltip content={<ChartTooltip isRevenue />} />
                        {compareEnabled && prevSummary && (
                          <Line
                            type="monotone"
                            dataKey="netPrevious"
                            name="Prior"
                            stroke={COLOR_PREV}
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            dot={false}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="netCurrent"
                          name="Net"
                          stroke={COLOR_CURRENT}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <OverviewCardFooter href="/orders" label="More details" />
                </CardContent>
              </Card>

              {/* Failed payments */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Failed payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-2xl font-semibold tracking-tight">
                    {fmt(
                      summary.revenue_by_status.Failed ??
                        summary.failed_payments.reduce(
                          (s, p) => s + p.amount,
                          0
                        )
                    )}
                  </p>
                  <div className="space-y-1">
                    {summary.failed_payments.length === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">
                        No failed payments in this range.
                      </p>
                    ) : (
                      summary.failed_payments.map((p, i) => (
                        <FailedPaymentRow
                          key={p.id}
                          payment={p}
                          striped={i % 2 === 1}
                        />
                      ))
                    )}
                  </div>
                  <OverviewCardFooter href="/orders" label="View all" />
                </CardContent>
              </Card>

              {/* New customers */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Customers
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-2xl font-semibold tracking-tight">
                    {summary.new_customers}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    unique buyers in range
                  </p>
                  <DeltaLine delta={customersDelta} />
                  <div className="mt-1 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={summary.new_customers_by_day.map((d) => ({
                          label: d.date,
                          current: d.count,
                        }))}
                      >
                        <XAxis dataKey="label" hide />
                        <YAxis hide allowDecimals={false} />
                        <RechartsTooltip
                          content={<ChartTooltip isRevenue={false} />}
                        />
                        <Line
                          type="monotone"
                          dataKey="current"
                          name="Customers"
                          stroke={COLOR_CURRENT}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <OverviewCardFooter href="/orders" label="More details" />
                </CardContent>
              </Card>

              {/* Top customers */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Top customers by spend
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  {summary.top_customers.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      No customer data in range.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {summary.top_customers.map((c, i) => (
                        <div
                          key={c.key}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm ${i % 2 === 1 ? "bg-muted" : ""}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.name}</p>
                            {c.email ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {c.email}
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 font-medium tabular-nums">
                            {fmt(c.spend)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <OverviewCardFooter href="/orders" label="View all" />
                </CardContent>
              </Card>

              {/* Keep: Avg order value (Stripe home does not show this) */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg order value
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-2xl font-semibold tracking-tight">
                    {fmt(summary.avg_order_value)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.order_count} orders · active only
                  </p>
                  <DeltaLine delta={aovDelta} asMoney />
                  <div className="mt-auto" />
                  <OverviewCardFooter href="/orders" label="More details" />
                </CardContent>
              </Card>

              {/* Keep: Orders count sparkline */}
              <Card className="flex flex-col md:col-span-2 xl:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Orders</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-2xl font-semibold tracking-tight">
                    {summary.order_count}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.orders_by_status.Complete} completed
                  </p>
                  <DeltaLine delta={orderDelta} />
                  <div className="mt-1 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide allowDecimals={false} />
                        <RechartsTooltip
                          content={<ChartTooltip isRevenue={false} />}
                        />
                        {compareEnabled && prevSummary && (
                          <Line
                            type="monotone"
                            dataKey="ordPrevious"
                            name="Prior"
                            stroke={COLOR_PREV}
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            dot={false}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="ordCurrent"
                          name="Orders"
                          stroke={COLOR_CURRENT}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <OverviewCardFooter href="/orders" label="View all" />
                </CardContent>
              </Card>
            </div>

            {/* Full-width revenue area (ours, richer than card sparkline) */}
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
                  <div className="flex rounded-md border">
                    {(["day", "week", "month"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGranularity(g)}
                        className={`px-3 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {g === "day"
                          ? "Daily"
                          : g === "week"
                            ? "Weekly"
                            : "Monthly"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    No revenue data for selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="stripeRevGradCurr"
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
                          id="stripeRevGradPrev"
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
                      <RechartsTooltip content={<ChartTooltip isRevenue />} />
                      {compareEnabled && prevSummary && (
                        <Area
                          type="monotone"
                          dataKey="previous"
                          name="Prior period"
                          stroke={COLOR_PREV}
                          strokeWidth={1.5}
                          strokeOpacity={0.7}
                          strokeDasharray="4 2"
                          fill="url(#stripeRevGradPrev)"
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
                        fill="url(#stripeRevGradCurr)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Orders line chart (was bar) */}
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
                  <div className="flex rounded-md border">
                    {(["day", "week", "month"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGranularity(g)}
                        className={`px-3 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {g === "day"
                          ? "Daily"
                          : g === "week"
                            ? "Weekly"
                            : "Monthly"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    No order data for selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
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
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip isRevenue={false} />}
                      />
                      {compareEnabled && prevSummary && (
                        <Line
                          type="monotone"
                          dataKey="ordPrevious"
                          name="Prior period"
                          stroke={COLOR_PREV}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={false}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="ordCurrent"
                        name="Current"
                        stroke={COLOR_CURRENT}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Donut + Top products */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Orders by status</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieSlices.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No data.
                    </p>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <ResponsiveContainer width={200} height={200}>
                          <PieChart>
                            <Pie
                              data={pieSlices}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={88}
                              dataKey="value"
                              stroke="none"
                              labelLine={false}
                              label={renderPieLabel}
                            >
                              {pieSlices.map((s) => (
                                <Cell
                                  key={s.name}
                                  fill={s.color}
                                  stroke="none"
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip content={<PieTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold">{pieTotal}</span>
                          <span className="text-xs text-muted-foreground">
                            orders
                          </span>
                        </div>
                      </div>
                      <div className="w-full space-y-1.5">
                        {pieSlices.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ background: s.color }}
                              />
                              <span className="text-muted-foreground">
                                {s.name}
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {s.value}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({pct(s.value, pieTotal)})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span>Top products by</span>
                    <Select
                      value={topProductsSort}
                      onValueChange={(v) =>
                        setTopProductsSort(v as "revenue" | "quantity")
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-6 w-auto gap-1 border-0 bg-transparent px-1.5 py-0 shadow-none dark:bg-transparent dark:hover:bg-muted/50"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="revenue">revenue</SelectItem>
                        <SelectItem value="quantity">quantity</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No completed orders in range.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {topProducts.map((p, i) => (
                        <StripeProductContextMenu
                          key={p.id}
                          product={{ id: p.id, name: p.name }}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-between rounded-md px-2 py-2 text-sm",
                              entityContextTargetClass,
                              i % 2 === 1 && "bg-muted"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}
                              >
                                {i + 1}
                              </span>
                              <span className="truncate">{p.name}</span>
                              <Badge className="shrink-0 border-transparent bg-primary/15 text-xs font-medium text-primary hover:bg-primary/20">
                                {topProductsSort === "quantity"
                                  ? fmt(p.revenue)
                                  : `${p.quantity} sold`}
                              </Badge>
                            </div>
                            <span className="ml-3 shrink-0 font-medium tabular-nums">
                              {topProductsSort === "quantity"
                                ? `${p.quantity} sold`
                                : fmt(p.revenue)}
                            </span>
                          </div>
                        </StripeProductContextMenu>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

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
                    <Link href="/orders">
                      View all <ArrowRightIcon className="size-3" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {summary.recent_orders.map((o, i) => (
                      <RecentOrderRow key={o.id} order={o} alt={i % 2 === 1} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </div>
  )
}

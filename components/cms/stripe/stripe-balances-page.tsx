"use client"

import { useEffect, useMemo, useState } from "react"
import { InfoIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  StripeBalancesSummary,
  StripePayoutView,
  PayoutStatus,
} from "@/lib/stripe/balances"

type ActivityTab = "payouts" | "all"

function fmt(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

function fmtShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function fmtMonthDayBox(isoDate: string): { month: string; day: string } {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return { month: "-", day: "-" }
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  }
}

function scheduleLabel(schedule: StripeBalancesSummary["schedule"]): string {
  if (!schedule) return "Payout schedule unavailable"
  if (schedule.interval === "manual") return "Manual payouts"
  if (schedule.interval === "daily") return "Transfer every day"
  if (schedule.interval === "weekly") {
    const day = schedule.weeklyAnchor
      ? schedule.weeklyAnchor.charAt(0).toUpperCase() +
        schedule.weeklyAnchor.slice(1)
      : "week"
    return `Transfer every ${day}`
  }
  if (schedule.interval === "monthly") {
    const n = schedule.monthlyAnchor
    return n ? `Transfer on day ${n} each month` : "Transfer monthly"
  }
  return "Automatic payouts"
}

function statusBadgeVariant(
  status: PayoutStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default"
  if (status === "failed" || status === "canceled") return "destructive"
  if (status === "upcoming" || status === "pending") return "secondary"
  return "outline"
}

function statusLabel(status: PayoutStatus): string {
  if (status === "in_transit") return "In transit"
  if (status === "upcoming") return "Upcoming"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function CurrencyMark({ code }: { code: string }) {
  return (
    <span
      className="inline-flex size-5 items-center justify-center rounded-sm border bg-muted text-[9px] font-semibold tracking-wide text-muted-foreground"
      aria-hidden
    >
      {code.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function StripeBalancesPage() {
  const [data, setData] = useState<StripeBalancesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ActivityTab>("payouts")
  const [currency, setCurrency] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/balances")
      if (!res.ok) throw new Error("Failed to load balances")
      const json = (await res.json()) as StripeBalancesSummary
      setData(json)
      setCurrency((prev) => prev ?? json.defaultCurrency)
    } catch {
      setError("Could not load Stripe balances.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activeCurrency = currency ?? data?.defaultCurrency ?? "usd"
  const balance =
    data?.balances.find((b) => b.currency === activeCurrency) ?? data?.primary

  const rows = useMemo(() => {
    if (!data) return [] as StripePayoutView[]
    const filtered = data.payouts.filter((p) => p.currency === activeCurrency)
    if (tab === "payouts") return filtered
    return filtered
  }, [data, activeCurrency, tab])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  if (!data || !balance) return null

  const next =
    data.nextPayout?.currency === activeCurrency ? data.nextPayout : null
  const currencies = data.balances.map((b) => b.currency)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Balances {fmt(balance.available, balance.currency)}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="About available balance"
                  >
                    <InfoIcon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Available funds ready for payout. Incoming amounts settle on
                  your payout schedule before they become available.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Payments balance and payout activity from your Stripe account.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCwIcon
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Currency tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b">
          {currencies.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCurrency(code)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeCurrency === code
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            {/* Main balance card */}
            <Card className="overflow-hidden">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CurrencyMark code={activeCurrency} />
                  <span>{activeCurrency.toUpperCase()}</span>
                </div>

                <div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {fmt(balance.available, balance.currency)}
                  </p>
                  {balance.pending > 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {fmt(balance.pending, balance.currency)} incoming
                    </p>
                  ) : null}
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  {(() => {
                    const total = Math.max(balance.total, 1)
                    const pendingPct = (balance.pending / total) * 100
                    const availablePct = (balance.available / total) * 100
                    return (
                      <div className="flex h-full w-full">
                        <div
                          className="h-full bg-sky-400/80"
                          style={{ width: `${pendingPct}%` }}
                        />
                        <div
                          className="h-full bg-primary/80"
                          style={{ width: `${availablePct}%` }}
                        />
                      </div>
                    )
                  })()}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm bg-sky-400/80" />
                      <span className="text-muted-foreground">Incoming</span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {fmt(balance.pending, balance.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm bg-primary/80" />
                      <span className="text-muted-foreground">Available</span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {fmt(balance.available, balance.currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t bg-muted/40 px-6 py-3 text-xs">
                <span className="text-muted-foreground">
                  Payouts{" "}
                  <span className="font-medium text-foreground">
                    {data.schedule
                      ? data.schedule.interval === "manual"
                        ? "Manual"
                        : data.schedule.interval.charAt(0).toUpperCase() +
                          data.schedule.interval.slice(1)
                      : "-"}
                  </span>
                </span>
                {data.schedule?.delayDays != null ? (
                  <span className="text-muted-foreground">
                    Settlement{" "}
                    <span className="font-medium text-foreground">
                      {data.schedule.delayDays} day
                      {data.schedule.delayDays === 1 ? "" : "s"}
                    </span>
                  </span>
                ) : null}
                <span className="text-muted-foreground">Payments balance</span>
              </div>
            </Card>

            {/* Recent activity */}
            <section id="payouts" className="scroll-mt-6 space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Recent activity
              </h2>
              <div className="flex gap-1 border-b">
                {(
                  [
                    ["payouts", "Payouts"],
                    ["all", "All activity"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      tab === id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No payout activity yet for {activeCurrency.toUpperCase()}.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Arrive by</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium tabular-nums">
                                {fmt(payout.amount, payout.currency)}
                              </span>
                              <Badge
                                variant={statusBadgeVariant(payout.status)}
                                className="gap-1 font-normal"
                              >
                                {(payout.status === "upcoming" ||
                                  payout.status === "pending") && (
                                  <InfoIcon className="size-3 opacity-70" />
                                )}
                                {statusLabel(payout.status)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payout.destination ?? "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground capitalize">
                            {payout.automatic ? "Automatic" : "Manual"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtShortDate(payout.arrivalDate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">
                Automatic payouts
              </h2>
              <div className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  S
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {scheduleLabel(data.schedule)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.primaryBank
                      ? `Primary account · ${data.primaryBank}`
                      : `${activeCurrency.toUpperCase()} payout destination`}
                  </p>
                </div>
              </div>
            </section>

            {next && next.arrivalDate ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold tracking-tight">
                  Upcoming
                </h2>
                <div className="flex items-start gap-3">
                  {(() => {
                    const box = fmtMonthDayBox(next.arrivalDate)
                    return (
                      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                        <span className="text-[10px] leading-none font-semibold">
                          {box.month}
                        </span>
                        <span className="text-base leading-tight font-semibold">
                          {box.day}
                        </span>
                      </div>
                    )
                  })()}
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">
                      {fmt(next.amount, next.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Payments balance → {data.primaryBank ?? "Bank account"}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {!data.livemode ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Showing test-mode Stripe balance data.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  )
}

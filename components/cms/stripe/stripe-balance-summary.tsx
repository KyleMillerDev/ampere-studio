"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { InfoIcon, Loader2Icon } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { StripeBalancesSummary } from "@/lib/stripe/balances"

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

function fmtExpected(isoDate: string | null): string | null {
  if (!isoDate) return null
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return `Expected ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`
}

function currencyLabel(code: string): string {
  return code.toUpperCase()
}

export function StripeBalanceSummary() {
  const [data, setData] = useState<StripeBalancesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch("/api/stripe/balances")
        if (!res.ok) throw new Error("failed")
        const json = (await res.json()) as StripeBalancesSummary
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading balances…
      </div>
    )
  }

  if (error || !data) return null

  const available = data.primary.available
  const next = data.nextPayout
  const payoutCurrency = next?.currency ?? data.primary.currency
  const payoutAmount = next?.amount ?? 0
  const expected = fmtExpected(next?.arrivalDate ?? null)

  return (
    <TooltipProvider>
      <div className="grid gap-8 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">Balances</h2>
            <Link
              href="/balances"
              className="text-sm font-medium text-primary hover:underline"
            >
              View
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-semibold tracking-tight">
              {fmt(available, data.primary.currency)}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="About balances"
                >
                  <InfoIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Available balance ready to pay out. Incoming funds appear under
                payouts until they settle.
              </TooltipContent>
            </Tooltip>
          </div>
          {data.primary.pending > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(data.primary.pending, data.primary.currency)} incoming
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">
              {currencyLabel(payoutCurrency)} payouts
            </h2>
            <Link
              href="/balances#payouts"
              className="text-sm font-medium text-primary hover:underline"
            >
              View
            </Link>
          </div>
          <p className="text-2xl font-semibold tracking-tight">
            {fmt(payoutAmount, payoutCurrency)}
          </p>
          {expected ? (
            <p className="mt-1 text-xs text-muted-foreground">{expected}</p>
          ) : next ? null : (
            <p className="mt-1 text-xs text-muted-foreground">
              No upcoming payout
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

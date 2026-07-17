import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe/config"
import { StripeNotConfiguredError } from "@/lib/stripe/products"

export type PayoutStatus =
  | "paid"
  | "pending"
  | "in_transit"
  | "canceled"
  | "failed"
  | "upcoming"

export interface StripePayoutView {
  id: string
  amount: number
  currency: string
  status: PayoutStatus
  arrivalDate: string
  created: string
  automatic: boolean
  method: string
  type: string
  destination: string | null
  description: string | null
  failureMessage: string | null
}

export interface StripePayoutSchedule {
  interval: "daily" | "weekly" | "monthly" | "manual"
  delayDays: number | null
  weeklyAnchor: string | null
  monthlyAnchor: number | null
  status: "enabled" | "disabled" | "unknown"
}

export interface StripeCurrencyBalance {
  currency: string
  available: number
  pending: number
  /** available + pending */
  total: number
}

export interface StripeNextPayout {
  amount: number
  currency: string
  arrivalDate: string | null
  status: PayoutStatus
  /** True when inferred from pending balance (no payout object yet). */
  estimated: boolean
  payoutId: string | null
}

export interface StripeBalancesSummary {
  livemode: boolean
  defaultCurrency: string
  balances: StripeCurrencyBalance[]
  /** Primary (default) currency balance, preferred for overview cards. */
  primary: StripeCurrencyBalance
  nextPayout: StripeNextPayout | null
  schedule: StripePayoutSchedule | null
  payouts: StripePayoutView[]
  primaryBank: string | null
}

async function requireStripe(): Promise<Stripe> {
  const stripe = await getStripeClient()
  if (!stripe) throw new StripeNotConfiguredError()
  return stripe
}

function amountForCurrency(
  entries: Array<{ amount: number; currency: string }>,
  currency: string
): number {
  return entries
    .filter((e) => e.currency === currency)
    .reduce((sum, e) => sum + e.amount, 0)
}

function unixToDateString(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10)
}

function formatDestination(
  destination: Stripe.Payout["destination"]
): string | null {
  if (!destination || typeof destination === "string") return null
  if ("deleted" in destination && destination.deleted) return null
  if (destination.object === "bank_account") {
    const bank = destination.bank_name?.trim() || "Bank account"
    return `${bank} ····${destination.last4}`
  }
  if (destination.object === "card") {
    const brand = destination.brand?.trim() || "Card"
    return `${brand} ····${destination.last4}`
  }
  return null
}

function toPayoutStatus(status: string): PayoutStatus {
  if (
    status === "paid" ||
    status === "pending" ||
    status === "in_transit" ||
    status === "canceled" ||
    status === "failed"
  ) {
    return status
  }
  return "pending"
}

function toPayoutView(payout: Stripe.Payout): StripePayoutView {
  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    status: toPayoutStatus(payout.status),
    arrivalDate: unixToDateString(payout.arrival_date),
    created: unixToDateString(payout.created),
    automatic: payout.automatic,
    method: payout.method,
    type: payout.type,
    destination: formatDestination(payout.destination),
    description: payout.description,
    failureMessage: payout.failure_message,
  }
}

function pickDefaultCurrency(
  balance: Stripe.Balance,
  accountCurrency: string | null
): string {
  if (accountCurrency) return accountCurrency
  const fromAvailable = balance.available[0]?.currency
  if (fromAvailable) return fromAvailable
  const fromPending = balance.pending[0]?.currency
  if (fromPending) return fromPending
  return "usd"
}

function buildBalances(
  balance: Stripe.Balance,
  defaultCurrency: string
): StripeCurrencyBalance[] {
  const currencies = new Set<string>()
  for (const row of balance.available) currencies.add(row.currency)
  for (const row of balance.pending) currencies.add(row.currency)
  currencies.add(defaultCurrency)

  const list = Array.from(currencies).map((currency) => {
    const available = amountForCurrency(balance.available, currency)
    const pending = amountForCurrency(balance.pending, currency)
    return { currency, available, pending, total: available + pending }
  })

  list.sort((a, b) => {
    if (a.currency === defaultCurrency) return -1
    if (b.currency === defaultCurrency) return 1
    return a.currency.localeCompare(b.currency)
  })
  return list
}

async function loadSchedule(stripe: Stripe): Promise<{
  schedule: StripePayoutSchedule | null
  defaultCurrency: string | null
  primaryBank: string | null
}> {
  let defaultCurrency: string | null = null
  let primaryBank: string | null = null
  let schedule: StripePayoutSchedule | null = null

  try {
    const settings = await stripe.balanceSettings.retrieve()
    const payouts = settings.payments.payouts
    const interval = payouts?.schedule?.interval ?? null
    schedule = {
      interval: interval ?? "manual",
      delayDays: settings.payments.settlement_timing.delay_days ?? null,
      weeklyAnchor: payouts?.schedule?.weekly_payout_days?.[0] ?? null,
      monthlyAnchor: payouts?.schedule?.monthly_payout_days?.[0] ?? null,
      status: payouts?.status ?? "unknown",
    }
  } catch {
    // Fall back to Account settings for older accounts / restricted keys.
  }

  try {
    const account = await stripe.accounts.retrieveCurrent({
      expand: ["external_accounts"],
    })
    defaultCurrency = account.default_currency ?? null

    const bank = account.external_accounts?.data?.find(
      (item): item is Stripe.BankAccount => item.object === "bank_account"
    )
    if (bank) {
      primaryBank = `${bank.bank_name?.trim() || "Bank account"} ····${bank.last4}`
    }

    if (!schedule && account.settings?.payouts?.schedule) {
      const s = account.settings.payouts.schedule
      const interval = (
        ["daily", "weekly", "monthly", "manual"] as const
      ).includes(s.interval as StripePayoutSchedule["interval"])
        ? (s.interval as StripePayoutSchedule["interval"])
        : "manual"
      schedule = {
        interval,
        delayDays: typeof s.delay_days === "number" ? s.delay_days : null,
        weeklyAnchor: s.weekly_anchor ?? s.weekly_payout_days?.[0] ?? null,
        monthlyAnchor: s.monthly_anchor ?? s.monthly_payout_days?.[0] ?? null,
        status: account.payouts_enabled ? "enabled" : "disabled",
      }
    }
  } catch {
    // Account retrieve can fail for some key types; balance/payouts still work.
  }

  return { schedule, defaultCurrency, primaryBank }
}

function estimateArrivalDate(delayDays: number | null): string | null {
  if (delayDays == null || delayDays < 0) return null
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + delayDays)
  // Skip weekends for a rough bank-arrival estimate.
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

function resolveNextPayout(
  payouts: StripePayoutView[],
  primary: StripeCurrencyBalance,
  schedule: StripePayoutSchedule | null
): StripeNextPayout | null {
  const open = payouts
    .filter(
      (p) =>
        p.currency === primary.currency &&
        (p.status === "pending" || p.status === "in_transit")
    )
    .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))

  if (open[0]) {
    return {
      amount: open[0].amount,
      currency: open[0].currency,
      arrivalDate: open[0].arrivalDate,
      status: open[0].status,
      estimated: false,
      payoutId: open[0].id,
    }
  }

  // Stripe dashboard shows an "upcoming" payout from pending funds even before
  // a payout object exists when automatic payouts are on.
  if (
    primary.pending > 0 &&
    schedule &&
    schedule.interval !== "manual" &&
    schedule.status !== "disabled"
  ) {
    return {
      amount: primary.pending,
      currency: primary.currency,
      arrivalDate: estimateArrivalDate(schedule.delayDays),
      status: "upcoming",
      estimated: true,
      payoutId: null,
    }
  }

  return null
}

/** Full balances + payouts snapshot for the active Stripe account. */
export async function getStripeBalancesSummary(): Promise<StripeBalancesSummary> {
  const stripe = await requireStripe()

  const [balance, payoutList, meta] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.payouts.list({
      limit: 40,
      expand: ["data.destination"],
    }),
    loadSchedule(stripe),
  ])

  const defaultCurrency = pickDefaultCurrency(balance, meta.defaultCurrency)
  const balances = buildBalances(balance, defaultCurrency)
  const primary = balances.find((b) => b.currency === defaultCurrency) ??
    balances[0] ?? {
      currency: defaultCurrency,
      available: 0,
      pending: 0,
      total: 0,
    }

  const payouts = payoutList.data.map(toPayoutView)
  const nextPayout = resolveNextPayout(payouts, primary, meta.schedule)

  // Surface estimated upcoming payout in the activity list when no object exists.
  const activityPayouts =
    nextPayout?.estimated && nextPayout.arrivalDate
      ? [
          {
            id: "upcoming-estimated",
            amount: nextPayout.amount,
            currency: nextPayout.currency,
            status: "upcoming" as const,
            arrivalDate: nextPayout.arrivalDate,
            created: unixToDateString(Math.floor(Date.now() / 1000)),
            automatic: true,
            method: "standard",
            type: "bank_account",
            destination: meta.primaryBank,
            description: "Upcoming automatic payout",
            failureMessage: null,
          },
          ...payouts,
        ]
      : payouts

  return {
    livemode: balance.livemode,
    defaultCurrency,
    balances,
    primary,
    nextPayout,
    schedule: meta.schedule,
    payouts: activityPayouts,
    primaryBank: meta.primaryBank,
  }
}

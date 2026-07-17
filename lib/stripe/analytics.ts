import type Stripe from "stripe"

import {
  buildEnrichedOrderItems,
  confirmationNumber,
  deriveOrderStatus,
  extractPaymentMethod,
  formatOrderProductName,
  getCustomerEmail,
  isIncompletePaymentIntent,
  parseLineMetadata,
  type OrderPaymentMethod,
  type OrderStatus,
} from "@/lib/stripe/orders"
import { getStripeClient } from "@/lib/stripe/config"
import { getCatalogMap, type CatalogMap } from "@/lib/stripe/catalog"
import { StripeNotConfiguredError } from "@/lib/stripe/products"

// ─── Filters ────────────────────────────────────────────────────────────────

export interface StripeAnalyticsFilters {
  dateFrom: string
  dateTo: string
  status?: string // ALL | Paid | Shipped | Complete | Cancelled | Disputed
  productName?: string // substring match on line item names
  minAmount?: number // dollars
  maxAmount?: number // dollars
}

// ─── Summary shape ───────────────────────────────────────────────────────────

export interface RecentStripeOrder {
  id: string
  confirmation_number: string
  amount: number
  status: OrderStatus
  created: number
  customer_email: string | null
  customer_name: string | null
  product_name: string
  extra_items: number
  is_refunded: boolean
  items: { name: string; quantity: number }[]
  payment_method: OrderPaymentMethod | null
}

export interface FailedStripePayment {
  id: string
  amount: number
  created: number
  customer_email: string | null
  customer_name: string | null
  failure_reason: string | null
  items: { name: string; quantity: number }[]
  payment_method: OrderPaymentMethod | null
}

export interface StripeTopCustomer {
  key: string
  name: string
  email: string | null
  /** Net spend in cents (order amounts minus refunds). */
  spend: number
  order_count: number
}

export interface StripeDashboardSummary {
  total_revenue: number // cents (non-cancelled/disputed orders)
  total_refunded: number // cents (sum of charge.amount_refunded)
  net_revenue: number // total_revenue - total_refunded
  order_count: number // all filtered orders
  avg_order_value: number // cents (active orders, net of refunds)

  orders_by_status: Record<OrderStatus, number>

  /** Gross volume (cents) attributed to each order status. */
  revenue_by_status: Record<OrderStatus, number>

  orders_by_day: { date: string; count: number }[]
  orders_by_week: { week: string; count: number }[]
  orders_by_month: { month: string; count: number }[]
  revenue_by_day: { date: string; revenue: number }[]
  revenue_by_week: { week: string; revenue: number }[]
  revenue_by_month: { month: string; revenue: number }[]
  net_revenue_by_day: { date: string; revenue: number }[]
  net_revenue_by_week: { week: string; revenue: number }[]
  net_revenue_by_month: { month: string; revenue: number }[]

  top_products: {
    id: string
    name: string
    quantity: number
    revenue: number
  }[]
  recent_orders: RecentStripeOrder[]
  failed_payments: FailedStripePayment[]
  top_customers: StripeTopCustomer[]
  new_customers: number
  new_customers_by_day: { date: string; count: number }[]

  /** Stripe-style "Today" hero (UTC calendar day). */
  today: {
    date: string
    gross_volume: number
    yesterday_gross_volume: number
    by_hour: { hour: number; today: number; yesterday: number }[]
  }

  date_from: string
  date_to: string
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toIsoDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10)
}

function toIsoWeek(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const day = d.getUTCDay() || 7
  const t = new Date(d)
  t.setUTCDate(d.getUTCDate() + 4 - day)
  const year = t.getUTCFullYear()
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const weekNo = Math.ceil(
    ((t.getTime() - startOfYear.getTime()) / 86_400_000 + 1) / 7
  )
  return `${year}-W${String(weekNo).padStart(2, "0")}`
}

function toIsoMonth(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function sortedMapEntries<T>(map: Map<string, T>): [string, T][] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function emptyStatusCounts(): Record<OrderStatus, number> {
  return {
    Paid: 0,
    Shipped: 0,
    Complete: 0,
    "Partially Refunded": 0,
    Refunded: 0,
    Cancelled: 0,
    Disputed: 0,
    Failed: 0,
    Abandoned: 0,
    "Checking out": 0,
  }
}

function isActiveRevenueStatus(status: OrderStatus): boolean {
  return (
    status !== "Cancelled" &&
    status !== "Disputed" &&
    status !== "Refunded" &&
    status !== "Failed" &&
    status !== "Abandoned" &&
    status !== "Checking out"
  )
}

function fillDays(
  from: string,
  to: string,
  values: Map<string, number>
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  let cursor = from
  while (cursor <= to) {
    out.push({ date: cursor, value: values.get(cursor) ?? 0 })
    cursor = addUtcDays(cursor, 1)
  }
  return out
}

// ─── Internal enriched order ──────────────────────────────────────────────────

interface RawOrder {
  pi: Stripe.PaymentIntent
  status: OrderStatus
  items: ReturnType<typeof buildEnrichedOrderItems>
  refundedAmount: number
  isRefunded: boolean
}

function chargeFromPi(pi: Stripe.PaymentIntent): Stripe.Charge | null {
  return pi.latest_charge && typeof pi.latest_charge !== "string"
    ? (pi.latest_charge as Stripe.Charge)
    : null
}

function getCustomerName(pi: Stripe.PaymentIntent): string | null {
  if (pi.shipping?.name?.trim()) return pi.shipping.name.trim()
  const charge = chargeFromPi(pi)
  const billing = charge?.billing_details?.name?.trim()
  return billing || null
}

function getPaymentFailureReason(pi: Stripe.PaymentIntent): string | null {
  const err = pi.last_payment_error
  if (err?.message?.trim()) return err.message.trim()
  if (err?.decline_code) return err.decline_code.replace(/_/g, " ")
  if (err?.code) return err.code.replace(/_/g, " ")
  const charge = chargeFromPi(pi)
  if (charge?.failure_message?.trim()) return charge.failure_message.trim()
  return null
}

function enrichPi(pi: Stripe.PaymentIntent, catalogMap: CatalogMap): RawOrder {
  const charge = chargeFromPi(pi)

  return {
    pi,
    status: deriveOrderStatus(pi, charge),
    items: buildEnrichedOrderItems(
      parseLineMetadata(pi.metadata?.lines),
      catalogMap
    ),
    refundedAmount: charge?.amount_refunded ?? 0,
    isRefunded: charge?.refunded === true,
  }
}

async function listOrdersInWindow(
  stripe: Stripe,
  catalogMap: CatalogMap,
  gteTs: number,
  lteTs: number
): Promise<RawOrder[]> {
  const orders: RawOrder[] = []
  for await (const pi of stripe.paymentIntents.list({
    created: { gte: gteTs, lte: lteTs },
    limit: 100,
    expand: ["data.latest_charge"],
  })) {
    if (isIncompletePaymentIntent(pi)) continue
    orders.push(enrichPi(pi, catalogMap))
  }
  return orders
}

function grossForOrder(o: RawOrder): number {
  return isActiveRevenueStatus(o.status) ? o.pi.amount : 0
}

function buildTodayHero(
  heroOrders: RawOrder[]
): StripeDashboardSummary["today"] {
  const today = utcTodayIso()
  const yesterday = addUtcDays(today, -1)
  const todayHours = Array.from({ length: 24 }, () => 0)
  const yesterdayHours = Array.from({ length: 24 }, () => 0)
  let todayGross = 0
  let yesterdayGross = 0

  for (const o of heroOrders) {
    const day = toIsoDate(o.pi.created)
    const amount = grossForOrder(o)
    if (amount <= 0) continue
    const hour = new Date(o.pi.created * 1000).getUTCHours()
    if (day === today) {
      todayGross += amount
      todayHours[hour] += amount
    } else if (day === yesterday) {
      yesterdayGross += amount
      yesterdayHours[hour] += amount
    }
  }

  // Cumulative through each hour (Stripe-style day curve).
  let todayRunning = 0
  let yesterdayRunning = 0
  const by_hour = todayHours.map((amt, hour) => {
    todayRunning += amt
    yesterdayRunning += yesterdayHours[hour]
    return {
      hour,
      today: todayRunning,
      yesterday: yesterdayRunning,
    }
  })

  return {
    date: today,
    gross_volume: todayGross,
    yesterday_gross_volume: yesterdayGross,
    by_hour,
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function computeStripeDashboardSummary(
  filters: StripeAnalyticsFilters
): Promise<StripeDashboardSummary> {
  const { dateFrom, dateTo, status, productName, minAmount, maxAmount } =
    filters

  const stripe = await getStripeClient()
  if (!stripe) throw new StripeNotConfiguredError()
  const catalogMap = await getCatalogMap()

  const gteTs = Math.floor(new Date(`${dateFrom}T00:00:00Z`).getTime() / 1000)
  const lteTs = Math.floor(new Date(`${dateTo}T23:59:59Z`).getTime() / 1000)

  const todayIso = utcTodayIso()
  const yesterdayIso = addUtcDays(todayIso, -1)
  const heroGte = Math.floor(
    new Date(`${yesterdayIso}T00:00:00Z`).getTime() / 1000
  )
  const heroLte = Math.floor(new Date(`${todayIso}T23:59:59Z`).getTime() / 1000)

  const [rangeOrders, heroOrders] = await Promise.all([
    listOrdersInWindow(stripe, catalogMap, gteTs, lteTs),
    // Reuse range fetch when it already covers the hero window.
    gteTs <= heroGte && lteTs >= heroLte
      ? Promise.resolve(null)
      : listOrdersInWindow(stripe, catalogMap, heroGte, heroLte),
  ])

  const allOrders = rangeOrders
  const todaySource =
    heroOrders ??
    rangeOrders.filter((o) => {
      const day = toIsoDate(o.pi.created)
      return day === todayIso || day === yesterdayIso
    })

  // In-memory filters (status, product, amount).
  const filtered = allOrders.filter((o) => {
    if (status && status !== "ALL" && o.status !== status) return false
    if (productName) {
      const lc = productName.toLowerCase()
      if (!o.items.some((it) => it.name.toLowerCase().includes(lc)))
        return false
    }
    if (minAmount !== undefined && o.pi.amount < minAmount * 100) return false
    if (maxAmount !== undefined && o.pi.amount > maxAmount * 100) return false
    return true
  })

  const activeOrders = filtered.filter((o) => isActiveRevenueStatus(o.status))
  const totalRevenue = activeOrders.reduce((s, o) => s + o.pi.amount, 0)
  const totalRefunded = filtered.reduce((s, o) => s + o.refundedAmount, 0)
  const netRevenue = Math.max(0, totalRevenue - totalRefunded)
  const orderCount = filtered.length
  const netActiveRevenue = activeOrders.reduce(
    (s, o) => s + Math.max(0, o.pi.amount - o.refundedAmount),
    0
  )
  const avgOrderValue =
    activeOrders.length > 0
      ? Math.round(netActiveRevenue / activeOrders.length)
      : 0

  const orders_by_status = emptyStatusCounts()
  const revenue_by_status = emptyStatusCounts()
  for (const o of filtered) {
    orders_by_status[o.status] += 1
    revenue_by_status[o.status] += o.pi.amount
  }

  const revByDay = new Map<string, number>()
  const revByWeek = new Map<string, number>()
  const revByMonth = new Map<string, number>()
  const netByDay = new Map<string, number>()
  const netByWeek = new Map<string, number>()
  const netByMonth = new Map<string, number>()
  const ordByDay = new Map<string, number>()
  const ordByWeek = new Map<string, number>()
  const ordByMonth = new Map<string, number>()

  for (const o of filtered) {
    const day = toIsoDate(o.pi.created)
    const week = toIsoWeek(o.pi.created)
    const month = toIsoMonth(o.pi.created)
    const rev = grossForOrder(o)
    const net = Math.max(0, rev - o.refundedAmount)

    revByDay.set(day, (revByDay.get(day) ?? 0) + rev)
    revByWeek.set(week, (revByWeek.get(week) ?? 0) + rev)
    revByMonth.set(month, (revByMonth.get(month) ?? 0) + rev)
    netByDay.set(day, (netByDay.get(day) ?? 0) + net)
    netByWeek.set(week, (netByWeek.get(week) ?? 0) + net)
    netByMonth.set(month, (netByMonth.get(month) ?? 0) + net)
    ordByDay.set(day, (ordByDay.get(day) ?? 0) + 1)
    ordByWeek.set(week, (ordByWeek.get(week) ?? 0) + 1)
    ordByMonth.set(month, (ordByMonth.get(month) ?? 0) + 1)
  }

  const revenue_by_day = fillDays(dateFrom, dateTo, revByDay).map((r) => ({
    date: r.date,
    revenue: r.value,
  }))
  const net_revenue_by_day = fillDays(dateFrom, dateTo, netByDay).map((r) => ({
    date: r.date,
    revenue: r.value,
  }))
  const revenue_by_week = sortedMapEntries(revByWeek).map(
    ([week, revenue]) => ({ week, revenue })
  )
  const revenue_by_month = sortedMapEntries(revByMonth).map(
    ([month, revenue]) => ({ month, revenue })
  )
  const net_revenue_by_week = sortedMapEntries(netByWeek).map(
    ([week, revenue]) => ({ week, revenue })
  )
  const net_revenue_by_month = sortedMapEntries(netByMonth).map(
    ([month, revenue]) => ({ month, revenue })
  )
  const orders_by_day = fillDays(dateFrom, dateTo, ordByDay).map((r) => ({
    date: r.date,
    count: r.value,
  }))
  const orders_by_week = sortedMapEntries(ordByWeek).map(([week, count]) => ({
    week,
    count,
  }))
  const orders_by_month = sortedMapEntries(ordByMonth).map(
    ([month, count]) => ({ month, count })
  )

  const productMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >()
  for (const o of activeOrders) {
    for (const item of o.items) {
      if (!item.productId) continue
      const prev = productMap.get(item.productId) ?? {
        name: item.name,
        quantity: 0,
        revenue: 0,
      }
      productMap.set(item.productId, {
        name: item.name,
        quantity: prev.quantity + item.quantity,
        revenue: prev.revenue + (item.lineTotal ?? 0),
      })
    }
  }
  // Full period product rollup; UI sorts/slices (revenue vs quantity).
  const top_products = [...productMap.entries()].map(([id, d]) => ({
    id,
    ...d,
  }))

  const recent_orders: RecentStripeOrder[] = [...filtered]
    .sort((a, b) => b.pi.created - a.pi.created)
    .slice(0, 8)
    .map((o) => {
      const items = o.items.map((it) => ({
        name: formatOrderProductName(it.name, it.partNumber),
        quantity: it.quantity,
      }))
      return {
        id: o.pi.id,
        confirmation_number: confirmationNumber(o.pi.id),
        amount: o.pi.amount,
        status: o.status,
        created: o.pi.created,
        customer_email: getCustomerEmail(o.pi),
        customer_name: getCustomerName(o.pi),
        product_name: items[0]?.name ?? "Order",
        extra_items: Math.max(0, items.length - 1),
        is_refunded: o.isRefunded,
        items,
        payment_method: extractPaymentMethod(chargeFromPi(o.pi)),
      }
    })

  const failed_payments: FailedStripePayment[] = filtered
    .filter((o) => o.status === "Failed")
    .sort((a, b) => b.pi.created - a.pi.created)
    .slice(0, 6)
    .map((o) => ({
      id: o.pi.id,
      amount: o.pi.amount,
      created: o.pi.created,
      customer_email: getCustomerEmail(o.pi),
      customer_name: getCustomerName(o.pi),
      failure_reason: getPaymentFailureReason(o.pi),
      items: o.items.map((it) => ({
        name: formatOrderProductName(it.name, it.partNumber),
        quantity: it.quantity,
      })),
      payment_method: extractPaymentMethod(chargeFromPi(o.pi)),
    }))

  const customerMap = new Map<
    string,
    { name: string; email: string | null; spend: number; order_count: number }
  >()
  const firstSeenDay = new Map<string, string>()
  for (const o of activeOrders) {
    const email = getCustomerEmail(o.pi)
    const name = o.pi.shipping?.name?.trim() || email || "Guest"
    const key = (email ?? name).toLowerCase()
    const prev = customerMap.get(key) ?? {
      name,
      email,
      spend: 0,
      order_count: 0,
    }
    const netSpend = Math.max(0, o.pi.amount - o.refundedAmount)
    customerMap.set(key, {
      name: prev.name || name,
      email: prev.email ?? email,
      spend: prev.spend + netSpend,
      order_count: prev.order_count + 1,
    })
    const day = toIsoDate(o.pi.created)
    const seen = firstSeenDay.get(key)
    if (!seen || day < seen) firstSeenDay.set(key, day)
  }

  const top_customers: StripeTopCustomer[] = [...customerMap.entries()]
    .map(([key, d]) => ({ key, ...d }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6)

  const newByDay = new Map<string, number>()
  for (const day of firstSeenDay.values()) {
    newByDay.set(day, (newByDay.get(day) ?? 0) + 1)
  }
  const new_customers_by_day = fillDays(dateFrom, dateTo, newByDay).map(
    (r) => ({
      date: r.date,
      count: r.value,
    })
  )

  return {
    total_revenue: totalRevenue,
    total_refunded: totalRefunded,
    net_revenue: netRevenue,
    order_count: orderCount,
    avg_order_value: avgOrderValue,
    orders_by_status,
    revenue_by_status,
    revenue_by_day,
    revenue_by_week,
    revenue_by_month,
    net_revenue_by_day,
    net_revenue_by_week,
    net_revenue_by_month,
    orders_by_day,
    orders_by_week,
    orders_by_month,
    top_products,
    recent_orders,
    failed_payments,
    top_customers,
    new_customers: customerMap.size,
    new_customers_by_day,
    today: buildTodayHero(todaySource),
    date_from: dateFrom,
    date_to: dateTo,
  }
}

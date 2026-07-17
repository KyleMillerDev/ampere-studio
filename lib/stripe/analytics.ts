import type Stripe from "stripe"

import {
  buildEnrichedOrderItems,
  confirmationNumber,
  deriveOrderStatus,
  getCustomerEmail,
  parseLineMetadata,
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
}

export interface StripeDashboardSummary {
  total_revenue: number // cents (non-cancelled/disputed orders)
  total_refunded: number // cents (sum of charge.amount_refunded)
  net_revenue: number // total_revenue - total_refunded
  order_count: number // all filtered orders
  avg_order_value: number // cents (from active orders only)

  orders_by_status: {
    Paid: number
    Shipped: number
    Complete: number
    "Partially Refunded": number
    Refunded: number
    Cancelled: number
    Disputed: number
    Failed: number
  }

  orders_by_day: { date: string; count: number }[]
  orders_by_week: { week: string; count: number }[]
  orders_by_month: { month: string; count: number }[]
  revenue_by_day: { date: string; revenue: number }[]
  revenue_by_week: { week: string; revenue: number }[]
  revenue_by_month: { month: string; revenue: number }[]

  top_products: {
    id: string
    name: string
    quantity: number
    revenue: number
  }[]
  recent_orders: RecentStripeOrder[]

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

function sortedMapEntries<T>(map: Map<string, T>): [string, T][] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

// ─── Internal enriched order ──────────────────────────────────────────────────

interface RawOrder {
  pi: Stripe.PaymentIntent
  status: OrderStatus
  items: ReturnType<typeof buildEnrichedOrderItems>
  refundedAmount: number
  isRefunded: boolean
}

function enrichPi(pi: Stripe.PaymentIntent, catalogMap: CatalogMap): RawOrder {
  const charge =
    pi.latest_charge && typeof pi.latest_charge !== "string"
      ? (pi.latest_charge as Stripe.Charge)
      : null

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

  // Fetch all succeeded PIs in the requested date window (auto-paginated).
  const allOrders: RawOrder[] = []
  for await (const pi of stripe.paymentIntents.list({
    created: { gte: gteTs, lte: lteTs },
    limit: 100,
    expand: ["data.latest_charge"],
  })) {
    if (pi.status !== "succeeded") continue
    allOrders.push(enrichPi(pi, catalogMap))
  }

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

  // Revenue: exclude cancelled, disputed, fully refunded, and failed orders.
  const activeOrders = filtered.filter(
    (o) =>
      o.status !== "Cancelled" &&
      o.status !== "Disputed" &&
      o.status !== "Refunded" &&
      o.status !== "Failed"
  )
  const totalRevenue = activeOrders.reduce((s, o) => s + o.pi.amount, 0)
  const totalRefunded = filtered.reduce((s, o) => s + o.refundedAmount, 0)
  const netRevenue = Math.max(0, totalRevenue - totalRefunded)
  const orderCount = filtered.length
  const avgOrderValue =
    activeOrders.length > 0 ? Math.round(totalRevenue / activeOrders.length) : 0

  const orders_by_status = {
    Paid: filtered.filter((o) => o.status === "Paid").length,
    Shipped: filtered.filter((o) => o.status === "Shipped").length,
    Complete: filtered.filter((o) => o.status === "Complete").length,
    "Partially Refunded": filtered.filter(
      (o) => o.status === "Partially Refunded"
    ).length,
    Refunded: filtered.filter((o) => o.status === "Refunded").length,
    Cancelled: filtered.filter((o) => o.status === "Cancelled").length,
    Disputed: filtered.filter((o) => o.status === "Disputed").length,
    Failed: filtered.filter((o) => o.status === "Failed").length,
  }

  // Time-series aggregation.
  const revByDay = new Map<string, number>()
  const revByWeek = new Map<string, number>()
  const revByMonth = new Map<string, number>()
  const ordByDay = new Map<string, number>()
  const ordByWeek = new Map<string, number>()
  const ordByMonth = new Map<string, number>()

  for (const o of filtered) {
    const day = toIsoDate(o.pi.created)
    const week = toIsoWeek(o.pi.created)
    const month = toIsoMonth(o.pi.created)
    const rev =
      o.status !== "Cancelled" &&
      o.status !== "Disputed" &&
      o.status !== "Refunded" &&
      o.status !== "Failed"
        ? o.pi.amount
        : 0

    revByDay.set(day, (revByDay.get(day) ?? 0) + rev)
    revByWeek.set(week, (revByWeek.get(week) ?? 0) + rev)
    revByMonth.set(month, (revByMonth.get(month) ?? 0) + rev)
    ordByDay.set(day, (ordByDay.get(day) ?? 0) + 1)
    ordByWeek.set(week, (ordByWeek.get(week) ?? 0) + 1)
    ordByMonth.set(month, (ordByMonth.get(month) ?? 0) + 1)
  }

  const revenue_by_day = sortedMapEntries(revByDay).map(([date, revenue]) => ({
    date,
    revenue,
  }))
  const revenue_by_week = sortedMapEntries(revByWeek).map(
    ([week, revenue]) => ({ week, revenue })
  )
  const revenue_by_month = sortedMapEntries(revByMonth).map(
    ([month, revenue]) => ({ month, revenue })
  )
  const orders_by_day = sortedMapEntries(ordByDay).map(([date, count]) => ({
    date,
    count,
  }))
  const orders_by_week = sortedMapEntries(ordByWeek).map(([week, count]) => ({
    week,
    count,
  }))
  const orders_by_month = sortedMapEntries(ordByMonth).map(
    ([month, count]) => ({ month, count })
  )

  // Top products by revenue.
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
  const top_products = [...productMap.entries()]
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Recent orders (most recent 8).
  const recent_orders: RecentStripeOrder[] = [...filtered]
    .sort((a, b) => b.pi.created - a.pi.created)
    .slice(0, 8)
    .map((o) => ({
      id: o.pi.id,
      confirmation_number: confirmationNumber(o.pi.id),
      amount: o.pi.amount,
      status: o.status,
      created: o.pi.created,
      customer_email: getCustomerEmail(o.pi),
      customer_name: o.pi.shipping?.name ?? null,
      product_name: o.items[0]?.name ?? "Order",
      extra_items: Math.max(0, o.items.length - 1),
      is_refunded: o.isRefunded,
    }))

  return {
    total_revenue: totalRevenue,
    total_refunded: totalRefunded,
    net_revenue: netRevenue,
    order_count: orderCount,
    avg_order_value: avgOrderValue,
    orders_by_status,
    revenue_by_day,
    revenue_by_week,
    revenue_by_month,
    orders_by_day,
    orders_by_week,
    orders_by_month,
    top_products,
    recent_orders,
    date_from: dateFrom,
    date_to: dateTo,
  }
}

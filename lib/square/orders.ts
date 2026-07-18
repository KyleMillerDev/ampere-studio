import { randomUUID } from "crypto"

import type { Fulfillment } from "square"

import { getActiveClientId } from "@/lib/cms/client-context"
import { buildVariationProductIndex } from "@/lib/square/catalog-resolve"
import { requireSquareClient } from "@/lib/square/client"
import { getSquareTokens } from "@/lib/square/config"
import {
  getMirrorOrder,
  listMirrorOrders,
  putMirrorOrder,
} from "@/lib/square/mirror"
import { listSquareProducts } from "@/lib/square/products"
import { deriveKmOrderState, sdkToSnake } from "@/lib/square/sync"
import type { KmOrderState, SquareOrder } from "@/lib/square/types"

// ─── Read from mirror ─────────────────────────────────────────────────────────

export async function listSquareOrders(opts?: {
  limit?: number
}): Promise<SquareOrder[]> {
  const clientId = await getActiveClientId()
  return listMirrorOrders(clientId, opts)
}

export async function getSquareOrder(
  rawId: string
): Promise<SquareOrder | null> {
  const clientId = await getActiveClientId()
  return getMirrorOrder(clientId, rawId)
}

// ─── Write to Square + update mirror ─────────────────────────────────────────

export async function updateOrderFulfillment(
  orderId: string,
  uid: string,
  state: string,
  tracking?: { carrier?: string; tracking_number?: string }
): Promise<SquareOrder> {
  const [sq, tokens, clientId] = await Promise.all([
    requireSquareClient(),
    getSquareTokens(),
    getActiveClientId(),
  ])
  if (!tokens) throw new Error("Square not configured")

  const existing = await getMirrorOrder(clientId, orderId)
  const version = existing?.version ?? 0

  const fulfillment: Record<string, unknown> = { uid, state }
  if (tracking) {
    fulfillment.shipmentDetails = {
      carrier: tracking.carrier,
      trackingNumber: tracking.tracking_number,
    }
  }

  const res = await sq.orders.update({
    orderId,
    order: {
      locationId: tokens.location_id,
      version: version + 1,
      fulfillments: [fulfillment as unknown as Fulfillment],
    },
    idempotencyKey: randomUUID(),
  })

  const updated = res.order as unknown as SquareOrder
  updated.km_state = deriveKmOrderState(updated)
  await putMirrorOrder(clientId, updated)
  return updated
}

export async function cancelOrder(orderId: string): Promise<SquareOrder> {
  const [sq, tokens, clientId] = await Promise.all([
    requireSquareClient(),
    getSquareTokens(),
    getActiveClientId(),
  ])
  if (!tokens) throw new Error("Square not configured")

  const existing = await getMirrorOrder(clientId, orderId)
  const version = existing?.version ?? 0

  const res = await sq.orders.update({
    orderId,
    order: {
      locationId: tokens.location_id,
      version: version + 1,
      state: "CANCELED",
    },
    idempotencyKey: randomUUID(),
  })

  const updated = res.order as unknown as SquareOrder
  updated.km_state = "CANCELED"
  await putMirrorOrder(clientId, updated)
  return updated
}

export interface DashboardFilters {
  dateFrom: string
  dateTo: string
  status?: string // ALL | OPEN | IN_PROGRESS | COMPLETED | CANCELED
  fulfillment?: string // ALL | PICKUP | SHIPMENT
  productName?: string // partial name match
  categoryName?: string // partial category name match
  minAmount?: number // dollars
  maxAmount?: number // dollars
}

// ─── Order fetching helpers ───────────────────────────────────────────────────

/** Build ISO-8601 monthly time chunks between two YYYY-MM-DD dates. */
function buildMonthChunks(
  dateFrom: string,
  dateTo: string
): Array<[string, string]> {
  const chunks: Array<[string, string]> = []
  let current = new Date(`${dateFrom}T00:00:00Z`)
  const end = new Date(`${dateTo}T23:59:59Z`)

  while (current <= end) {
    const chunkStart = current.toISOString()
    const nextMonth = new Date(current)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    nextMonth.setUTCDate(1)
    nextMonth.setUTCHours(0, 0, 0, 0)
    const chunkEnd = new Date(
      Math.min(end.getTime(), nextMonth.getTime() - 1)
    ).toISOString()
    chunks.push([chunkStart, chunkEnd])
    current = nextMonth
  }
  return chunks
}

/** Fetch all orders within a date window from Square, following cursor pagination. */
async function fetchOrderChunk(
  sq: Awaited<ReturnType<typeof requireSquareClient>>,
  locationId: string,
  startAt: string,
  endAt: string
): Promise<SquareOrder[]> {
  const orders: SquareOrder[] = []
  let cursor: string | undefined

  do {
    const res = await sq.orders.search({
      locationIds: [locationId],
      query: {
        filter: { dateTimeFilter: { createdAt: { startAt, endAt } } },
        sort: { sortField: "CREATED_AT", sortOrder: "DESC" },
      },
      limit: 500,
      ...(cursor ? { cursor } : {}),
    })

    const raw = res as Record<string, unknown>
    for (const orderRaw of (raw.orders as unknown[]) ?? []) {
      const o = sdkToSnake(orderRaw) as unknown as SquareOrder
      o.km_state = deriveKmOrderState(o)
      orders.push(o)
    }
    cursor = raw.cursor as string | undefined
  } while (cursor)

  return orders
}

export async function computeDashboardSummary(
  filters: DashboardFilters
): Promise<import("@/lib/square/types").DashboardSummary> {
  const {
    dateFrom,
    dateTo,
    status,
    fulfillment,
    productName,
    categoryName,
    minAmount,
    maxAmount,
  } = filters

  // Fetch orders directly from Square for the requested date range so that
  // long ranges (6M, 1Y) aren't limited by the 500-order mirror cap.
  // Mirrors KMCMS's monthly-chunk + concurrent approach.
  const [sq, tokens] = await Promise.all([
    requireSquareClient(),
    getSquareTokens(),
  ])
  if (!tokens) throw new Error("Square not configured")

  const chunks = buildMonthChunks(dateFrom, dateTo)
  const MAX_CONCURRENT = 6
  const allOrders: SquareOrder[] = []

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT)
    const results = await Promise.all(
      batch.map(([start, end]) =>
        fetchOrderChunk(sq, tokens.location_id, start, end)
      )
    )
    for (const chunk of results) allOrders.push(...chunk)
  }

  function getKmState(o: SquareOrder) {
    return o.km_state ?? "OPEN"
  }

  function getFulfillmentBucket(
    o: SquareOrder
  ): "PICKUP" | "SHIPMENT" | "OTHER" {
    const t = o.fulfillments?.[0]?.type?.toUpperCase()
    if (t === "PICKUP") return "PICKUP"
    if (t === "SHIPMENT") return "SHIPMENT"
    return "OTHER"
  }

  // Square already filtered by date range; apply remaining in-memory filters.
  const filtered = allOrders.filter((o) => {
    // only paid orders (exclude abandoned checkouts without tenders)
    if (o.tenders && (o.tenders as unknown[]).length === 0) return false

    const state = getKmState(o)
    if (status && status !== "ALL" && state !== status) return false

    if (fulfillment && fulfillment !== "ALL") {
      if (getFulfillmentBucket(o) !== fulfillment) return false
    }

    if (productName) {
      const lc = productName.toLowerCase()
      const match = o.line_items?.some((li) =>
        (li.name ?? "").toLowerCase().includes(lc)
      )
      if (!match) return false
    }

    if (categoryName) {
      const lc = categoryName.toLowerCase()
      const match = o.line_items?.some((li) => {
        const meta = li as unknown as Record<string, unknown>
        const cats = meta.catalog_object_id ?? ""
        const varMeta = (meta.variation_name ?? "") as string
        return (
          varMeta.toLowerCase().includes(lc) ||
          String(cats).toLowerCase().includes(lc)
        )
      })
      if (!match) return false
    }

    const total = o.total_money?.amount ?? 0
    if (minAmount !== undefined && total < minAmount * 100) return false
    if (maxAmount !== undefined && total > maxAmount * 100) return false

    return true
  })

  const completed = filtered.filter(
    (o) => getKmState(o) === "COMPLETED" || o.state === "COMPLETED"
  )

  const totalRevenue = completed.reduce(
    (s, o) => s + (o.total_money?.amount ?? 0),
    0
  )
  const totalTax = completed.reduce(
    (s, o) => s + (o.total_tax_money?.amount ?? 0),
    0
  )

  const ordersByState = {
    OPEN: filtered.filter((o) => getKmState(o) === "OPEN").length,
    IN_PROGRESS: filtered.filter((o) => getKmState(o) === "IN_PROGRESS").length,
    COMPLETED: completed.length,
    CANCELED: filtered.filter((o) => getKmState(o) === "CANCELED").length,
  }

  const ordersByFulfillment = {
    shipment: filtered.filter((o) => getFulfillmentBucket(o) === "SHIPMENT")
      .length,
    pickup: filtered.filter((o) => getFulfillmentBucket(o) === "PICKUP").length,
    other: filtered.filter((o) => getFulfillmentBucket(o) === "OTHER").length,
  }

  // Revenue and order counts by day/week/month
  const revenueByDay = new Map<string, number>()
  const ordersByDay = new Map<string, number>()
  const revenueByWeek = new Map<string, number>()
  const ordersByWeek = new Map<string, number>()
  const revenueByMonth = new Map<string, number>()
  const ordersByMonth = new Map<string, number>()

  for (const o of filtered) {
    const d = new Date(o.created_at ?? "")
    if (isNaN(d.getTime())) continue
    const dayKey = d.toISOString().slice(0, 10)
    const weekKey = `${d.getFullYear()}-W${String(Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, "0")}`
    const monthKey = d.toISOString().slice(0, 7)
    const rev = o.total_money?.amount ?? 0
    const isCompleted = getKmState(o) === "COMPLETED" || o.state === "COMPLETED"

    revenueByDay.set(
      dayKey,
      (revenueByDay.get(dayKey) ?? 0) + (isCompleted ? rev : 0)
    )
    ordersByDay.set(dayKey, (ordersByDay.get(dayKey) ?? 0) + 1)
    revenueByWeek.set(
      weekKey,
      (revenueByWeek.get(weekKey) ?? 0) + (isCompleted ? rev : 0)
    )
    ordersByWeek.set(weekKey, (ordersByWeek.get(weekKey) ?? 0) + 1)
    revenueByMonth.set(
      monthKey,
      (revenueByMonth.get(monthKey) ?? 0) + (isCompleted ? rev : 0)
    )
    ordersByMonth.set(monthKey, (ordersByMonth.get(monthKey) ?? 0) + 1)
  }

  // Top products (resolve variation catalog ids to parent ITEM ids)
  const variationIndex = buildVariationProductIndex(await listSquareProducts())

  const productRevenue = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >()
  for (const o of completed) {
    for (const li of o.line_items ?? []) {
      const catalogId = li.catalog_object_id
      const resolved = catalogId ? variationIndex.get(catalogId) : undefined
      const pid = resolved?.id ?? catalogId ?? "unknown"
      const name = resolved?.name ?? li.name ?? "Unknown Product"
      const qty = parseInt(li.quantity, 10) || 0
      const rev = li.total_money?.amount ?? 0
      const existing = productRevenue.get(pid) ?? {
        name,
        quantity: 0,
        revenue: 0,
      }
      productRevenue.set(pid, {
        name,
        quantity: existing.quantity + qty,
        revenue: existing.revenue + rev,
      })
    }
  }

  const topProducts = Array.from(productRevenue.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Top variations
  const variationRevenue = new Map<
    string,
    { quantity: number; revenue: number }
  >()
  for (const o of completed) {
    for (const li of o.line_items ?? []) {
      const key = `${li.name ?? "?"} - ${li.variation_name ?? ""}`.trim()
      const qty = parseInt(li.quantity, 10) || 0
      const rev = li.total_money?.amount ?? 0
      const ex = variationRevenue.get(key) ?? { quantity: 0, revenue: 0 }
      variationRevenue.set(key, {
        quantity: ex.quantity + qty,
        revenue: ex.revenue + rev,
      })
    }
  }
  const topVariations = Array.from(variationRevenue.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Top option values (individual option value qty across all completed orders)
  const optionValueQty = new Map<string, number>()
  for (const o of completed) {
    for (const li of o.line_items ?? []) {
      const varName = (li.variation_name ?? "").trim()
      if (!varName) continue
      for (const val of varName.split(",")) {
        const v = val.trim()
        if (v)
          optionValueQty.set(
            v,
            (optionValueQty.get(v) ?? 0) + (parseFloat(li.quantity) || 1)
          )
      }
    }
  }
  const topOptionValues = Array.from(optionValueQty.entries())
    .map(([value, quantity]) => ({ value, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)

  const recentOrders = filtered.slice(0, 10).map((o) => ({
    id: o.id,
    created_at: o.created_at,
    total_money: o.total_money ?? { amount: 0, currency: "USD" as const },
    km_state: getKmState(o) as KmOrderState,
    product_name: o.line_items?.[0]?.name ?? "Order",
    extra_items: Math.max(0, (o.line_items?.length ?? 1) - 1),
    source: o.source?.name ?? "Square",
  }))

  return {
    total_revenue: totalRevenue,
    total_sales_tax: totalTax,
    order_count: filtered.length,
    avg_order_value:
      completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
    orders_by_state: ordersByState,
    orders_by_fulfillment: ordersByFulfillment,
    orders_by_day: Array.from(ordersByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    orders_by_week: Array.from(ordersByWeek.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    orders_by_month: Array.from(ordersByMonth.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    revenue_by_day: Array.from(revenueByDay.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    revenue_by_week: Array.from(revenueByWeek.entries())
      .map(([week, revenue]) => ({ week, revenue }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    revenue_by_month: Array.from(revenueByMonth.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    top_products: topProducts,
    top_variations: topVariations,
    top_option_values: topOptionValues,
    recent_orders: recentOrders,
    date_from: dateFrom,
    date_to: dateTo,
  }
}

"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  ChevronDown,
  ChevronRight,
} from "@hugeicons/core-free-icons"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { OrderAmount } from "@/components/cms/stripe/orders/order-amount"
import { OrderActions } from "@/components/cms/stripe/orders/order-actions"
import {
  OrdersToolbar,
  type OrderFilters,
} from "@/components/cms/stripe/orders/orders-toolbar"
import { formatStripeAmount, formatUnixDate } from "@/lib/utils"
import type { OrderView } from "@/lib/stripe/orders"
import type { CatalogProduct } from "@/lib/stripe/catalog"

interface OrdersTableProps {
  orders: OrderView[]
  catalogProducts: CatalogProduct[]
}

function itemSummary(order: OrderView): string {
  if (order.lineItems.length === 1) return order.lineItems[0].name
  return `${order.lineItems.length} Items`
}

function matchesFilters(order: OrderView, filters: OrderFilters): boolean {
  if (filters.status && order.status !== filters.status) return false

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime() / 1000
    if (order.created < from) return false
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime() / 1000 + 86399
    if (order.created > to) return false
  }

  if (filters.totalMin !== undefined) {
    if (order.amount < filters.totalMin * 100) return false
  }
  if (filters.totalMax !== undefined) {
    if (order.amount > filters.totalMax * 100) return false
  }

  if (filters.carrier && order.trackingCarrier !== filters.carrier) return false

  if (filters.hasTracking === true && !order.tracking) return false
  if (filters.hasTracking === false && !!order.tracking) return false

  if (filters.hasDispute === true && !order.hasDispute) return false
  if (filters.hasDispute === false && order.hasDispute) return false

  const hasRefund = order.refundedAmount > 0
  if (filters.isRefunded === true && !hasRefund) return false
  if (filters.isRefunded === false && hasRefund) return false

  return true
}

function scoreSearch(order: OrderView, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  const haystack = [
    order.id,
    order.confirmationNumber,
    order.customerName ?? "",
    order.customerEmail ?? "",
    order.tracking ?? "",
    ...order.lineItems.map((l) => l.name),
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

function sortOrders(orders: OrderView[], sort: string): OrderView[] {
  const sorted = [...orders]
  switch (sort) {
    case "date_asc":
      return sorted.sort((a, b) => a.created - b.created)
    case "date_desc":
      return sorted.sort((a, b) => b.created - a.created)
    case "shipped_desc":
      return sorted.sort((a, b) => (b.shippedAt ?? 0) - (a.shippedAt ?? 0))
    case "total_asc":
      return sorted.sort((a, b) => a.amount - b.amount)
    case "total_desc":
      return sorted.sort((a, b) => b.amount - a.amount)
    default:
      return sorted.sort((a, b) => b.created - a.created)
  }
}

function ExpandedRow({ order }: { order: OrderView }) {
  const addr = order.shipping?.address
  const addressLines = addr
    ? [
        addr.line1,
        addr.line2,
        [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
        addr.country,
      ].filter(Boolean)
    : []

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell />
      <TableCell colSpan={4} className="pt-2 pb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Line items */}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Items
            </p>
            <div className="space-y-2">
              {order.lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <HugeiconsIcon
                        icon={Image01Icon}
                        className="size-3.5 text-muted-foreground"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} ×{" "}
                      {item.unitAmount !== null
                        ? formatStripeAmount(item.unitAmount, order.currency)
                        : "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">
                    {item.lineTotal !== null
                      ? formatStripeAmount(item.lineTotal, order.currency)
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="mt-3 space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>
                  {order.subtotal !== null
                    ? formatStripeAmount(order.subtotal, order.currency)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>
                  {order.shippingCost !== null
                    ? formatStripeAmount(order.shippingCost, order.currency)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <OrderAmount
                  amount={order.amount}
                  refundedAmount={order.refundedAmount}
                  currency={order.currency}
                  className="items-end"
                />
              </div>
              {order.refundedAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Refunded</span>
                  <span>
                    −{formatStripeAmount(order.refundedAmount, order.currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping address */}
          {addressLines.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ship to
              </p>
              <address className="text-sm leading-relaxed text-foreground not-italic">
                {order.shipping?.name && (
                  <div className="font-medium">{order.shipping.name}</div>
                )}
                {addressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </address>
              {order.tracking && (
                <div className="mt-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Tracking
                  </p>
                  <p className="text-sm text-foreground">
                    {order.tracking}
                    {order.trackingCarrier ? ` (${order.trackingCarrier})` : ""}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell />
    </TableRow>
  )
}

export function OrdersTable({ orders, catalogProducts }: OrdersTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<OrderFilters>({})
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("date_desc")

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const matched = orders.filter(
      (o) => matchesFilters(o, filters) && scoreSearch(o, search)
    )
    return sortOrders(matched, sort)
  }, [orders, filters, search, sort])

  return (
    <div className="space-y-4">
      <OrdersToolbar
        orders={orders}
        catalogProducts={catalogProducts}
        filters={filters}
        onFiltersChange={setFilters}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Date</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const expanded = expandedIds.has(order.id)
                const customerName =
                  order.customerName ??
                  order.customerEmail ??
                  "Unknown customer"
                return (
                  <>
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => toggleExpand(order.id)}
                    >
                      <TableCell className="px-3">
                        <HugeiconsIcon
                          icon={expanded ? ChevronDown : ChevronRight}
                          className="size-4 text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {customerName}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            #{order.confirmationNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {itemSummary(order)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        <OrderAmount
                          amount={order.amount}
                          refundedAmount={order.refundedAmount}
                          currency={order.currency}
                        />
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatUnixDate(order.created)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <OrderActions order={order} />
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <ExpandedRow key={`${order.id}-exp`} order={order} />
                    )}
                  </>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

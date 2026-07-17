"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  ChevronDown,
  ChevronRight,
  FilterIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { OrderAmount } from "@/components/cms/stripe/orders/order-amount"
import { OrderLineItems } from "@/components/cms/stripe/orders/order-line-items"
import { OrderPaymentMethodCell } from "@/components/cms/stripe/orders/order-payment-method"
import { OrderMobileCard } from "@/components/cms/stripe/orders/order-mobile-card"
import { OrderRowActions } from "@/components/cms/stripe/orders/order-actions"
import {
  ORDER_STATUS_OPTIONS,
  OrdersToolbar,
  type OrderFilters,
} from "@/components/cms/stripe/orders/orders-toolbar"
import { cn } from "@/lib/utils"
import type { OrderStatusFilter } from "@/lib/stripe/order-model"
import {
  formatLocalFriendlyDateTime,
  formatPhone,
  formatStripeAmount,
  formatUnixDate,
} from "@/lib/utils"
import {
  formatOrderProductName,
  type OrderView,
} from "@/lib/stripe/order-model"
import type { CatalogProduct } from "@/lib/stripe/catalog-types"

interface OrdersTableProps {
  orders: OrderView[]
  catalogProducts: CatalogProduct[]
}

function itemSummary(order: OrderView): string {
  if (order.lineItems.length === 1) {
    const item = order.lineItems[0]
    return formatOrderProductName(item.name, item.partNumber)
  }
  return `${order.lineItems.length} Items`
}

function matchesFilters(order: OrderView, filters: OrderFilters): boolean {
  const selected = filters.statuses
  const archivedSelected = selected?.includes("Archived") ?? false
  const statusSelected =
    selected?.filter((status) => status !== "Archived") ?? []

  // Archived orders stay hidden unless the Archived filter is enabled.
  if (order.archived && !archivedSelected) return false

  if (selected && selected.length > 0) {
    // Only Archived selected: show archived orders of any status.
    if (statusSelected.length === 0) {
      if (!order.archived) return false
    } else if (!statusSelected.includes(order.status)) {
      return false
    }
  } else if (order.status === "Abandoned" || order.status === "Checking out") {
    // Abandoned / Checking out stay hidden until opted in.
    return false
  }

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
    ...order.lineItems.map((l) => formatOrderProductName(l.name, l.partNumber)),
    ...order.lineItems.map((l) => l.partNumber ?? ""),
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

function customerSortKey(order: OrderView): string {
  return (order.customerName ?? order.customerEmail ?? "").toLowerCase()
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
    case "customer_asc":
      return sorted.sort((a, b) =>
        customerSortKey(a).localeCompare(customerSortKey(b))
      )
    case "customer_desc":
      return sorted.sort((a, b) =>
        customerSortKey(b).localeCompare(customerSortKey(a))
      )
    case "items_asc":
      return sorted.sort((a, b) => {
        const byCount = a.lineItems.length - b.lineItems.length
        if (byCount !== 0) return byCount
        return itemSummary(a).localeCompare(itemSummary(b))
      })
    case "items_desc":
      return sorted.sort((a, b) => {
        const byCount = b.lineItems.length - a.lineItems.length
        if (byCount !== 0) return byCount
        return itemSummary(b).localeCompare(itemSummary(a))
      })
    default:
      return sorted.sort((a, b) => b.created - a.created)
  }
}

type SortableColumn = "customer" | "items" | "total" | "date"

function parseSort(sort: string): {
  column: SortableColumn | null
  direction: "asc" | "desc"
} {
  const match = sort.match(/^(customer|items|total|date)_(asc|desc)$/)
  if (!match) return { column: null, direction: "desc" }
  return {
    column: match[1] as SortableColumn,
    direction: match[2] as "asc" | "desc",
  }
}

/** First click = descending, second click on same column = ascending. */
function nextSortForColumn(
  currentSort: string,
  column: SortableColumn
): string {
  const { column: active, direction } = parseSort(currentSort)
  if (active === column && direction === "desc") return `${column}_asc`
  return `${column}_desc`
}

function SortableHead({
  label,
  column,
  sort,
  onSortChange,
  className,
}: {
  label: string
  column: SortableColumn
  sort: string
  onSortChange: (sort: string) => void
  className?: string
}) {
  const { column: active, direction } = parseSort(sort)
  const isActive = active === column
  const icon = !isActive
    ? ArrowUpDownIcon
    : direction === "desc"
      ? ArrowDown01Icon
      : ArrowUp01Icon

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          className?.includes("text-right") && "w-full justify-end",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onSortChange(nextSortForColumn(sort, column))}
      >
        {label}
        <HugeiconsIcon
          icon={icon}
          className={cn("size-3.5", isActive ? "opacity-100" : "opacity-50")}
        />
      </button>
    </TableHead>
  )
}

function StatusFilterHead({
  statuses,
  onStatusesChange,
}: {
  statuses: OrderStatusFilter[] | undefined
  onStatusesChange: (statuses: OrderStatusFilter[] | undefined) => void
}) {
  const activeCount = statuses?.length ?? 0

  function toggleStatus(status: OrderStatusFilter, checked: boolean) {
    const current = statuses ?? []
    const next = checked
      ? [...current, status]
      : current.filter((s) => s !== status)
    onStatusesChange(next.length > 0 ? next : undefined)
  }

  return (
    <TableHead>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
              activeCount > 0 ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Status
            <HugeiconsIcon
              icon={FilterIcon}
              className={cn(
                "size-3.5",
                activeCount > 0 ? "opacity-100" : "opacity-50"
              )}
            />
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 space-y-2 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Filter by status
            </p>
            {activeCount > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onStatusesChange(undefined)}
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1">
            {ORDER_STATUS_OPTIONS.map((status) => {
              const checked = statuses?.includes(status) ?? false
              return (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleStatus(status, value === true)
                    }
                  />
                  <span>{status}</span>
                </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </TableHead>
  )
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
  const customerPhone = order.shipping?.phone ?? null
  const hasShipTo =
    addressLines.length > 0 ||
    !!order.shipping?.name ||
    !!order.customerEmail ||
    !!customerPhone ||
    !!order.tracking

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell />
      <TableCell colSpan={6} className="pt-2 pb-4">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-12">
          {/* Line items */}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Items
            </p>
            <OrderLineItems
              lineItems={order.lineItems}
              originalLineItems={order.originalLineItems}
              currency={order.currency}
              compact
            />
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

          {/* Shipping address + contact */}
          {hasShipTo && (
            <div className="sm:pl-2">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ship to
              </p>
              <address className="space-y-0.5 text-sm leading-relaxed text-foreground not-italic">
                {order.shipping?.name && (
                  <div className="font-medium">{order.shipping.name}</div>
                )}
                {addressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {(order.customerEmail || customerPhone) && (
                  <div className="space-y-0.5 pt-2">
                    {order.customerEmail && (
                      <div>
                        <a
                          href={`mailto:${order.customerEmail}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.customerEmail}
                        </a>
                      </div>
                    )}
                    {customerPhone && (
                      <div className="text-muted-foreground">
                        Phone:{" "}
                        <a
                          href={`tel:${customerPhone.replace(/\D/g, "")}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatPhone(customerPhone)}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </address>
              {order.tracking && (
                <div className="mt-4">
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

        <div className="mt-4 flex justify-end border-t pt-3">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/orders/${order.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              View full order
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          </Button>
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

      {/* Desktop table — cards until lg */}
      <div className="@container hidden rounded-lg border bg-card lg:block">
        <TooltipProvider delayDuration={500}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortableHead
                  label="Customer"
                  column="customer"
                  sort={sort}
                  onSortChange={setSort}
                />
                <SortableHead
                  label="Items"
                  column="items"
                  sort={sort}
                  onSortChange={setSort}
                />
                <SortableHead
                  label="Total"
                  column="total"
                  sort={sort}
                  onSortChange={setSort}
                />
                <StatusFilterHead
                  statuses={filters.statuses}
                  onStatusesChange={(statuses) =>
                    setFilters((prev) => ({ ...prev, statuses }))
                  }
                />
                <TableHead>Payment method</TableHead>
                <SortableHead
                  label="Date"
                  column="date"
                  sort={sort}
                  onSortChange={setSort}
                  className="text-right"
                />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
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
                    <OrderRowActions
                      key={order.id}
                      order={order}
                      expandedRow={
                        expanded ? <ExpandedRow order={order} /> : null
                      }
                    >
                      {(dropdown) => (
                        <TableRow
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
                            <div className="flex flex-wrap items-center gap-1.5">
                              <OrderStatusBadge status={order.status} />
                              {order.archived ? (
                                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                  Archived
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <OrderPaymentMethodCell
                              paymentMethod={order.paymentMethod}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-default">
                                  {formatUnixDate(order.created)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {formatLocalFriendlyDateTime(order.created)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {dropdown}
                          </TableCell>
                        </TableRow>
                      )}
                    </OrderRowActions>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>

      {/* Mobile / tablet list (Stripe-style cards) */}
      <div className="@container overflow-hidden rounded-lg border bg-card lg:hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No orders found.
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((order) => (
              <OrderMobileCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDownIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CursorHoverPopup } from "@/components/cms/stripe/cursor-hover-popup"
import { OrderPaymentMethodCell } from "@/components/cms/stripe/orders/order-payment-method"
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { RecentStripeOrder } from "@/lib/stripe/analytics"

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface RecentOrderRowProps {
  order: RecentStripeOrder
  alt?: boolean
}

export function RecentOrderRow({ order, alt = false }: RecentOrderRowProps) {
  const [itemsOpen, setItemsOpen] = useState(false)
  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0)
  const relative = formatRelativeTime(
    new Date(order.created * 1000).toISOString()
  )

  return (
    <CursorHoverPopup
      label="Order details"
      contentKey={itemsOpen}
      content={
        <div className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {order.customer_name?.trim() || "Guest"}
              </p>
              {order.customer_email && (
                <p className="truncate text-xs text-muted-foreground">
                  {order.customer_email}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-medium tabular-nums">
                {fmt(order.amount)}
              </span>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>

          <div>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => setItemsOpen((v) => !v)}
              aria-expanded={itemsOpen}
            >
              <span>
                Products
                {itemCount > 0 ? ` (${itemCount})` : ""}
              </span>
              <ChevronDownIcon
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  itemsOpen && "rotate-180"
                )}
              />
            </button>
            {itemsOpen && (
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/30 px-2 py-1.5">
                {order.items.length === 0 ? (
                  <li className="text-xs text-muted-foreground">
                    No line items on this order.
                  </li>
                ) : (
                  order.items.map((it, idx) => (
                    <li
                      key={`${it.name}-${idx}`}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 leading-snug">{it.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        ×{it.quantity}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t pt-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Payment method
              </p>
              <div className="mt-1">
                <OrderPaymentMethodCell paymentMethod={order.payment_method} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Order ID
              </p>
              <p className="mt-0.5 font-mono text-[11px] leading-snug">
                #{order.confirmation_number}
              </p>
            </div>
          </div>

          <Button size="sm" className="w-full" asChild>
            <Link href={`/orders/${order.id}`}>View details</Link>
          </Button>
        </div>
      }
    >
      <Link
        href={`/orders/${order.id}`}
        className={cn(
          "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
          alt && "bg-muted"
        )}
      >
        <OrderStatusBadge status={order.status} />
        <span className="min-w-0 flex-1 truncate">
          {order.product_name}
          {order.extra_items > 0 && (
            <span className="ml-1 text-muted-foreground">
              +{order.extra_items}
            </span>
          )}
        </span>
        {order.is_refunded && order.status !== "Refunded" && (
          <Badge variant="outline" className="shrink-0 text-xs text-amber-600">
            Refunded
          </Badge>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {relative}
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {fmt(order.amount)}
        </span>
      </Link>
    </CursorHoverPopup>
  )
}

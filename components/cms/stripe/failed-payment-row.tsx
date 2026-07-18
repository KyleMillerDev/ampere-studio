"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CursorHoverPopup } from "@/components/cms/stripe/cursor-hover-popup"
import {
  OrderEntityContextMenu,
  orderActionViewFromFailed,
} from "@/components/cms/stripe/orders/order-actions"
import { OrderPaymentMethodCell } from "@/components/cms/stripe/orders/order-payment-method"
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { confirmationNumber } from "@/lib/stripe/order-model"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { FailedStripePayment } from "@/lib/stripe/analytics"

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface FailedPaymentRowProps {
  payment: FailedStripePayment
  striped?: boolean
}

export function FailedPaymentRow({
  payment,
  striped = false,
}: FailedPaymentRowProps) {
  const [itemsOpen, setItemsOpen] = useState(false)
  const itemCount = payment.items.reduce((s, it) => s + it.quantity, 0)
  const relative = formatRelativeTime(
    new Date(payment.created * 1000).toISOString()
  )
  const actionOrder = orderActionViewFromFailed(payment)

  return (
    <OrderEntityContextMenu order={actionOrder}>
      <div>
        <CursorHoverPopup
          label="Failed payment details"
          contentKey={itemsOpen}
          content={
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {payment.customer_name?.trim() || "Guest"}
                  </p>
                  {payment.customer_email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {payment.customer_email}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {fmt(payment.amount)}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Failure reason
                </p>
                <p className="mt-0.5 text-sm leading-snug">
                  {payment.failure_reason || "No failure reason provided."}
                </p>
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
                    {payment.items.length === 0 ? (
                      <li className="text-xs text-muted-foreground">
                        No line items on this order.
                      </li>
                    ) : (
                      payment.items.map((it, idx) => (
                        <li
                          key={`${it.name}-${idx}`}
                          className="flex items-start justify-between gap-3 text-xs"
                        >
                          <span className="min-w-0 leading-snug">
                            {it.name}
                          </span>
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
                    <OrderPaymentMethodCell
                      paymentMethod={payment.payment_method}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Order ID
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] leading-snug">
                    #{confirmationNumber(payment.id)}
                  </p>
                </div>
              </div>

              <Button size="sm" className="w-full" asChild>
                <Link href={`/orders/${payment.id}`}>View details</Link>
              </Button>
            </div>
          }
        >
          <Link
            href={`/orders/${payment.id}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
              entityContextTargetClass,
              striped && "bg-muted"
            )}
          >
            <p className="min-w-0 truncate text-muted-foreground">{relative}</p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-medium tabular-nums">
                {fmt(payment.amount)}
              </span>
              <OrderStatusBadge status="Failed" />
            </div>
          </Link>
        </CursorHoverPopup>
      </div>
    </OrderEntityContextMenu>
  )
}

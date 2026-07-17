"use client"

import { useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { OrderAmount } from "@/components/cms/stripe/orders/order-amount"
import { OrderPaymentMethodCell } from "@/components/cms/stripe/orders/order-payment-method"
import { OrderRowActions } from "@/components/cms/stripe/orders/order-actions"
import {
  formatOrderProductName,
  type OrderView,
} from "@/lib/stripe/order-model"
import { formatUnixDate } from "@/lib/utils"

const MAX_VISIBLE_THUMBS = 3

function itemsLabel(order: OrderView): string {
  const count = order.lineItems.length
  if (count === 1) return "1 Item"
  return `${count} Items`
}

function OrderItemThumbStack({ order }: { order: OrderView }) {
  const items = order.lineItems
  if (items.length === 0) return null

  const visible = items.slice(0, MAX_VISIBLE_THUMBS)
  const overflow = items.length - visible.length

  return (
    <AvatarGroup className="-space-x-2">
      {visible.map((item) => (
        <Avatar key={item.ref} size="sm" className="bg-muted">
          {item.image ? <AvatarImage src={item.image} alt={item.name} /> : null}
          <AvatarFallback className="text-[10px]">
            {item.name.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <AvatarGroupCount className="size-6 text-[10px] font-medium">
          +{overflow}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  )
}

interface OrderMobileCardProps {
  order: OrderView
}

export function OrderMobileCard({ order }: OrderMobileCardProps) {
  const router = useRouter()
  const suppressNav = useRef(false)

  const customerName =
    order.customerName ?? order.customerEmail ?? "Unknown customer"
  const showEmail =
    !!order.customerEmail &&
    !!order.customerName &&
    order.customerEmail !== order.customerName

  const shipPlace = [
    order.shipping?.address?.city,
    order.shipping?.address?.state,
  ]
    .filter(Boolean)
    .join(", ")

  const singleItem = order.lineItems.length === 1 ? order.lineItems[0] : null
  const singleItemLabel = singleItem
    ? formatOrderProductName(singleItem.name, singleItem.partNumber)
    : null

  return (
    <OrderRowActions
      order={order}
      onContextMenuOpenChange={(open) => {
        if (open) suppressNav.current = true
      }}
    >
      {(dropdown) => (
        <div
          role="link"
          tabIndex={0}
          className="cursor-pointer px-4 py-3.5 transition-colors outline-none select-none [-webkit-touch-callout:none] focus-visible:bg-muted/30 active:bg-muted/40 @sm:px-5 @sm:py-4 @lg:px-6"
          onClick={() => {
            if (suppressNav.current) {
              suppressNav.current = false
              return
            }
            router.push(`/orders/${order.id}`)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              router.push(`/orders/${order.id}`)
            }
          }}
        >
          {/* Header: customer + status */}
          <div className="flex items-start gap-3 @sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground">
                {customerName}
              </p>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <span className="shrink-0">#{order.confirmationNumber}</span>
                {showEmail && (
                  <>
                    <span className="hidden opacity-40 @sm:inline" aria-hidden>
                      ·
                    </span>
                    <span className="hidden min-w-0 truncate @sm:inline">
                      {order.customerEmail}
                    </span>
                  </>
                )}
                <span className="hidden opacity-40 @md:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden shrink-0 @md:inline">
                  {formatUnixDate(order.created)}
                </span>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <OrderStatusBadge status={order.status} />
                {order.archived ? (
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Archived
                  </span>
                ) : null}
              </div>
              {dropdown}
            </div>
          </div>

          {/* Items + total */}
          <div className="mt-2.5 flex items-center justify-between gap-3 @sm:mt-3 @sm:gap-4">
            <div className="flex min-w-0 items-center gap-2.5 @sm:gap-3">
              <OrderItemThumbStack order={order} />
              <div className="min-w-0">
                <span className="text-base font-medium text-foreground">
                  {itemsLabel(order)}
                </span>
                {singleItemLabel && (
                  <p className="mt-0.5 hidden max-w-56 truncate text-sm text-muted-foreground @lg:block @xl:max-w-80">
                    {singleItemLabel}
                  </p>
                )}
              </div>
            </div>
            <OrderAmount
              amount={order.amount}
              refundedAmount={order.refundedAmount}
              currency={order.currency}
              className="shrink-0 items-end font-semibold text-foreground"
            />
          </div>

          {/* Payment / ship-to / CTA */}
          <div className="mt-2 flex items-center justify-between gap-3 @sm:mt-3 @sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <OrderPaymentMethodCell paymentMethod={order.paymentMethod} />
              {/* Date on mid widths; moves up into the header at @md */}
              <span
                className="hidden opacity-40 @sm:inline @md:hidden"
                aria-hidden
              >
                ·
              </span>
              <span className="hidden shrink-0 @sm:inline @md:hidden">
                {formatUnixDate(order.created)}
              </span>
              {shipPlace ? (
                <>
                  <span className="hidden opacity-40 @md:inline" aria-hidden>
                    ·
                  </span>
                  <span className="hidden min-w-0 truncate @md:inline">
                    {shipPlace}
                  </span>
                </>
              ) : null}
            </div>
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <Link
                href={`/orders/${order.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                View details
              </Link>
            </Button>
          </div>
        </div>
      )}
    </OrderRowActions>
  )
}

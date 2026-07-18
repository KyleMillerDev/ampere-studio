"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { StripeProductContextMenu } from "@/components/cms/stripe/product-actions"
import { cn, formatStripeAmount } from "@/lib/utils"
import {
  buildOrderLineChanges,
  formatOrderProductName,
  type EnrichedLineItem,
  type OrderLineChange,
} from "@/lib/stripe/order-model"

interface OrderLineItemsProps {
  lineItems: EnrichedLineItem[]
  originalLineItems?: EnrichedLineItem[]
  currency: string
  /** Compact layout for expanded table rows. */
  compact?: boolean
}

function QuantityLabel({
  change,
  currency,
  compact,
}: {
  change: OrderLineChange
  currency: string
  compact?: boolean
}) {
  const { originalQuantity: original, currentQuantity: current } = change
  const textClass = compact ? "text-xs" : "text-sm"
  const unit =
    change.unitAmount !== null
      ? formatStripeAmount(change.unitAmount, currency)
      : null

  if (original !== null && current !== null && original !== current) {
    return (
      <p className={cn(textClass, "text-muted-foreground")}>
        Qty <span className="line-through">{original}</span>
        {" → "}
        <span className="font-medium text-foreground">{current}</span>
        {unit && <> × {unit}</>}
      </p>
    )
  }

  if (original !== null && current === null) {
    return (
      <p className={cn(textClass, "text-muted-foreground")}>
        Removed
        {original > 0 ? ` (was ${original})` : ""}
        {unit && <> · {unit} each</>}
      </p>
    )
  }

  if (original === null && current !== null) {
    return (
      <p className={cn(textClass, "text-muted-foreground")}>
        Added · {current} × {unit ?? "—"}
      </p>
    )
  }

  return (
    <p className={cn(textClass, "text-muted-foreground")}>
      {current ?? original ?? 0} × {unit ?? "—"}
    </p>
  )
}

function lineTotalForChange(change: OrderLineChange): number | null {
  if (change.unitAmount === null) return null
  const qty = change.currentQuantity ?? change.originalQuantity
  if (qty === null) return null
  return change.unitAmount * qty
}

function LineRowContent({
  change,
  currency,
  compact,
}: {
  change: OrderLineChange
  currency: string
  compact?: boolean
}) {
  const removed = change.currentQuantity === null
  const added = change.originalQuantity === null
  const qtyChanged =
    change.originalQuantity !== null &&
    change.currentQuantity !== null &&
    change.originalQuantity !== change.currentQuantity
  const total = lineTotalForChange(change)
  const displayName = formatOrderProductName(change.name, change.partNumber)
  const imageSize = compact ? "size-9" : "size-14"
  const iconSize = compact ? "size-3.5" : "size-5"

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md",
        removed && "opacity-60",
        change.productId && entityContextTargetClass
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
          imageSize
        )}
      >
        {change.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={change.image}
            alt={displayName}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <HugeiconsIcon
            icon={Image01Icon}
            className={cn(iconSize, "text-muted-foreground")}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "font-medium",
              compact && "truncate text-sm",
              removed && "line-through"
            )}
          >
            {displayName}
          </p>
          {removed && (
            <Badge variant="outline" className="text-[10px]">
              Removed
            </Badge>
          )}
          {added && (
            <Badge variant="secondary" className="text-[10px]">
              Added
            </Badge>
          )}
          {qtyChanged && (
            <Badge variant="outline" className="text-[10px]">
              Qty changed
            </Badge>
          )}
        </div>
        <QuantityLabel change={change} currency={currency} compact={compact} />
      </div>
      <p
        className={cn(
          "shrink-0 font-semibold",
          compact && "text-sm font-medium",
          removed && "text-muted-foreground line-through"
        )}
      >
        {total !== null ? formatStripeAmount(total, currency) : "—"}
      </p>
    </div>
  )
}

function LineRow({
  change,
  currency,
  compact,
}: {
  change: OrderLineChange
  currency: string
  compact?: boolean
}) {
  const content = (
    <LineRowContent change={change} currency={currency} compact={compact} />
  )

  if (!change.productId) return content

  return (
    <StripeProductContextMenu
      product={{ id: change.productId, name: change.name }}
    >
      {/* Stop bubbling so the parent order row context menu does not steal the event. */}
      <div onContextMenu={(event) => event.stopPropagation()}>{content}</div>
    </StripeProductContextMenu>
  )
}

function plainItemToChange(item: EnrichedLineItem): OrderLineChange {
  return {
    ref: item.ref,
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    partNumber: item.partNumber,
    image: item.image,
    unitAmount: item.unitAmount,
    originalQuantity: item.quantity,
    currentQuantity: item.quantity,
  }
}

export function OrderLineItems({
  lineItems,
  originalLineItems = [],
  currency,
  compact = false,
}: OrderLineItemsProps) {
  const changes = buildOrderLineChanges(originalLineItems, lineItems)
  const rows: OrderLineChange[] = changes ?? lineItems.map(plainItemToChange)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items parsed.</p>
    )
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {changes && (
        <p className="text-xs text-muted-foreground">
          Showing checkout quantities vs current after edit.
        </p>
      )}
      {rows.map((change) => (
        <LineRow
          key={change.ref}
          change={change}
          currency={currency}
          compact={compact}
        />
      ))}
    </div>
  )
}

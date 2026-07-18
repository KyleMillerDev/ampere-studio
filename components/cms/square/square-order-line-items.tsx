"use client"

import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { SquareProductContextMenu } from "@/components/cms/square/product-actions"
import { cn } from "@/lib/utils"
import type { SquareOrderLineItem } from "@/lib/square/types"

function formatMoney(amount?: number): string {
  if (amount === undefined) return "—"
  return `$${(amount / 100).toFixed(2)}`
}

type ResolvedProduct = { id: string; name: string }

function LineItemRow({
  item,
  product,
}: {
  item: SquareOrderLineItem
  product?: ResolvedProduct
}) {
  const content = (
    <div
      className={cn(
        "flex items-start justify-between rounded-md px-1 py-0.5",
        product && entityContextTargetClass
      )}
    >
      <div>
        <p className="font-medium">{item.name}</p>
        {item.variation_name && (
          <p className="text-sm text-muted-foreground">{item.variation_name}</p>
        )}
        {item.note && (
          <p className="text-xs text-muted-foreground italic">{item.note}</p>
        )}
        {(item.modifiers ?? []).map((m, mi) => (
          <p key={mi} className="text-xs text-muted-foreground">
            + {m.name}
          </p>
        ))}
      </div>
      <div className="text-right">
        <p className="text-sm">x{item.quantity}</p>
        <p className="font-medium">{formatMoney(item.total_money?.amount)}</p>
      </div>
    </div>
  )

  if (!product) return content

  return (
    <SquareProductContextMenu product={product}>
      {content}
    </SquareProductContextMenu>
  )
}

export function SquareOrderLineItems({
  items,
  productByCatalogId = {},
}: {
  items: SquareOrderLineItem[]
  /** Map of ITEM / ITEM_VARIATION catalog ids → dashboard product ref. */
  productByCatalogId?: Record<string, ResolvedProduct>
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items.</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const catalogId = item.catalog_object_id
        const product = catalogId ? productByCatalogId[catalogId] : undefined
        return (
          <LineItemRow
            key={`${item.uid ?? catalogId ?? index}`}
            item={item}
            product={product}
          />
        )
      })}
    </div>
  )
}

import type { SquareMirrorProduct } from "@/lib/square/types"

export type SquareProductRef = {
  id: string
  name: string
}

/**
 * Map catalog object ids (ITEM and ITEM_VARIATION) to the parent product
 * used by dashboard `/products/[id]` routes.
 */
export function buildVariationProductIndex(
  products: SquareMirrorProduct[]
): Map<string, SquareProductRef> {
  const map = new Map<string, SquareProductRef>()
  for (const product of products) {
    const ref: SquareProductRef = {
      id: product.raw_id,
      name: product.item_data.name,
    }
    map.set(product.raw_id, ref)
    for (const variation of product.item_data.variations ?? []) {
      if (variation.id) map.set(variation.id, ref)
    }
  }
  return map
}

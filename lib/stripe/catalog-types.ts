/**
 * Client-safe Stripe catalog types.
 * Keep free of Stripe SDK clients and other server-only imports.
 */

export interface CatalogProduct {
  id: string
  name: string
  slug: string | null
  /** From product.metadata.part_number when set. */
  partNumber: string | null
  image: string | null
  unitAmount: number | null
  category: string | null
}

/**
 * A map from all known references (product id, metadata.part_number, metadata.slug)
 * to the catalog product. Used for resilient line-item matching.
 */
export type CatalogMap = Map<string, CatalogProduct>

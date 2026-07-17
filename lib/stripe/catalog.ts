import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe/config"
import { StripeNotConfiguredError } from "@/lib/stripe/products"
import type { CatalogMap, CatalogProduct } from "@/lib/stripe/catalog-types"

export type { CatalogMap, CatalogProduct } from "@/lib/stripe/catalog-types"

/** Maps a raw Stripe product to the canonical catalog shape. */
export function mapStripeProduct(product: Stripe.Product): CatalogProduct {
  const defaultPrice =
    product.default_price && typeof product.default_price !== "string"
      ? product.default_price
      : null

  return {
    id: product.id,
    name: product.name,
    slug: (product.metadata?.slug as string | undefined) ?? null,
    partNumber: (product.metadata?.part_number as string | undefined) ?? null,
    image: product.images?.[0] ?? null,
    unitAmount: defaultPrice?.unit_amount ?? null,
    category: (product.metadata?.category as string | undefined) ?? null,
  }
}

export async function getCatalogMap(): Promise<CatalogMap> {
  const stripe = await getStripeClient()
  if (!stripe) throw new StripeNotConfiguredError()

  const map: CatalogMap = new Map()

  for await (const product of stripe.products.list({
    active: true,
    limit: 100,
    expand: ["data.default_price"],
  })) {
    const entry = mapStripeProduct(product)

    map.set(product.id, entry)

    if (entry.partNumber) map.set(entry.partNumber, entry)

    if (entry.slug) map.set(entry.slug, entry)
  }

  return map
}

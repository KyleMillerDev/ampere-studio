import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe/config"
import type {
  MetadataSuggestions,
  StripePriceCreateInput,
  StripePriceView,
  StripeProductCreateInput,
  StripeProductUpdateInput,
  StripeProductView,
} from "@/lib/validation/stripe-product.schema"

/** Thrown by helpers when the active client has no Stripe keys configured. */
export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured for this client")
    this.name = "StripeNotConfiguredError"
  }
}

async function requireStripe(): Promise<Stripe> {
  const stripe = await getStripeClient()
  if (!stripe) throw new StripeNotConfiguredError()
  return stripe
}

function toPriceView(
  price: Stripe.Price,
  defaultPriceId: string | null
): StripePriceView {
  return {
    id: price.id,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    type: price.type === "recurring" ? "recurring" : "one_time",
    interval: price.recurring?.interval,
    intervalCount: price.recurring?.interval_count,
    nickname: price.nickname ?? undefined,
    created: price.created,
    isDefault: price.id === defaultPriceId,
  }
}

function toProductView(product: Stripe.Product): StripeProductView {
  const defaultPriceId =
    typeof product.default_price === "string"
      ? product.default_price
      : (product.default_price?.id ?? null)
  const defaultPrice =
    product.default_price && typeof product.default_price !== "string"
      ? toPriceView(product.default_price, defaultPriceId)
      : null
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    active: product.active,
    images: product.images ?? [],
    metadata: { ...product.metadata },
    defaultPriceId,
    defaultPrice,
    created: product.created,
    updated: product.updated,
  }
}

async function fetchAllProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const products: Stripe.Product[] = []
  for await (const product of stripe.products.list({
    limit: 100,
    expand: ["data.default_price"],
  })) {
    products.push(product)
  }
  return products
}

export async function listStripeProducts(): Promise<StripeProductView[]> {
  const stripe = await requireStripe()
  const products = await fetchAllProducts(stripe)
  return products.map(toProductView)
}

export async function getStripeProduct(
  id: string
): Promise<StripeProductView | null> {
  const stripe = await requireStripe()
  try {
    const product = await stripe.products.retrieve(id, {
      expand: ["default_price"],
    })
    return toProductView(product)
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "resource_missing"
    ) {
      return null
    }
    throw err
  }
}

function priceDataFromInput(
  input: StripePriceCreateInput
): Stripe.ProductCreateParams.DefaultPriceData {
  return {
    currency: input.currency,
    unit_amount: input.unitAmount,
    ...(input.type === "recurring"
      ? {
          recurring: {
            interval: input.interval ?? "month",
            interval_count: input.intervalCount ?? 1,
          },
        }
      : {}),
  }
}

export async function createStripeProduct(
  input: StripeProductCreateInput
): Promise<StripeProductView> {
  const stripe = await requireStripe()
  const product = await stripe.products.create(
    {
      name: input.name,
      description: input.description || undefined,
      active: input.active,
      images: input.images.length ? input.images : undefined,
      metadata: input.metadata,
      default_price_data: input.defaultPrice
        ? priceDataFromInput(input.defaultPrice)
        : undefined,
    },
    undefined
  )
  // Nickname cannot be set through default_price_data; patch it afterwards.
  if (
    input.defaultPrice?.nickname &&
    typeof product.default_price === "string"
  ) {
    await stripe.prices.update(product.default_price, {
      nickname: input.defaultPrice.nickname,
    })
  }
  const refreshed = await stripe.products.retrieve(product.id, {
    expand: ["default_price"],
  })
  return toProductView(refreshed)
}

export async function updateStripeProduct(
  id: string,
  input: StripeProductUpdateInput
): Promise<StripeProductView> {
  const stripe = await requireStripe()
  const product = await stripe.products.update(
    id,
    {
      name: input.name,
      description:
        input.description !== undefined ? input.description || "" : undefined,
      active: input.active,
      // Stripe clears images when passed an empty array.
      images: input.images,
      metadata: input.metadata,
      default_price: input.defaultPriceId,
    },
    undefined
  )
  const refreshed = await stripe.products.retrieve(product.id, {
    expand: ["default_price"],
  })
  return toProductView(refreshed)
}

/** Stripe products with prices can't be hard-deleted; archive instead. */
export async function archiveStripeProduct(
  id: string
): Promise<StripeProductView> {
  const stripe = await requireStripe()
  const product = await stripe.products.update(id, { active: false })
  return toProductView(product)
}

export async function listPricesForProduct(
  productId: string,
  defaultPriceId: string | null
): Promise<StripePriceView[]> {
  const stripe = await requireStripe()
  const prices: Stripe.Price[] = []
  for await (const price of stripe.prices.list({
    product: productId,
    limit: 100,
  })) {
    prices.push(price)
  }
  return prices
    .map((p) => toPriceView(p, defaultPriceId))
    .sort((a, b) => b.created - a.created)
}

export async function createPrice(
  productId: string,
  input: StripePriceCreateInput
): Promise<StripePriceView> {
  const stripe = await requireStripe()
  const price = await stripe.prices.create({
    product: productId,
    currency: input.currency,
    unit_amount: input.unitAmount,
    nickname: input.nickname || undefined,
    ...(input.type === "recurring"
      ? {
          recurring: {
            interval: input.interval ?? "month",
            interval_count: input.intervalCount ?? 1,
          },
        }
      : {}),
  })
  return toPriceView(price, null)
}

export async function setPriceActive(
  priceId: string,
  active: boolean
): Promise<StripePriceView> {
  const stripe = await requireStripe()
  const price = await stripe.prices.update(priceId, { active })
  return toPriceView(price, null)
}

/**
 * Scan all products' metadata and return distinct values per key for autofill.
 * Keys whose name contains "id" keep an empty suggestion list since their
 * values are unique identifiers rather than reusable labels.
 */
export async function getMetadataSuggestions(): Promise<MetadataSuggestions> {
  const stripe = await requireStripe()
  const products = await fetchAllProducts(stripe)
  const suggestions = new Map<string, Set<string>>()
  for (const product of products) {
    for (const [key, value] of Object.entries(product.metadata ?? {})) {
      if (!suggestions.has(key)) suggestions.set(key, new Set())
      const isIdLike = key.toLowerCase().includes("id")
      if (!isIdLike && value) suggestions.get(key)!.add(value)
    }
  }
  const result: MetadataSuggestions = {}
  for (const [key, values] of suggestions) {
    result[key] = Array.from(values).sort((a, b) => a.localeCompare(b))
  }
  return result
}

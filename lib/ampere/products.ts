import { v4 as uuidv4 } from "uuid"
import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { getActiveClientId } from "@/lib/cms/client-context"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { AMPERE_SK_PREFIX, CONTENT_TABLE } from "@/lib/cms/constants"
import type {
  AmpereProductCreateInput,
  AmpereProductUpdateInput,
} from "@/lib/validation/ampere-product.schema"
import type {
  MetadataSuggestions,
  StripePriceCreateInput,
  StripePriceView,
  StripeProductView,
} from "@/lib/validation/stripe-product.schema"

export class AmpereCatalogDisabledError extends Error {
  constructor() {
    super("Ampere catalog is not enabled for this client")
    this.name = "AmpereCatalogDisabledError"
  }
}

export class AmpereProductNotFoundError extends Error {
  constructor() {
    super("Product not found")
    this.name = "AmpereProductNotFoundError"
  }
}

export class AmpereValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AmpereValidationError"
  }
}

export interface AmpereStoredPrice {
  id: string
  active: boolean
  currency: string
  unitAmount: number
  type: "one_time" | "recurring"
  interval?: "day" | "week" | "month" | "year"
  intervalCount?: number
  nickname?: string
  created: number
}

export interface AmpereStoredProduct {
  client_id: string
  id: string
  kind: "ampere_product"
  name: string
  description: string
  active: boolean
  images: string[]
  metadata: Record<string, string>
  defaultPriceId: string | null
  prices: AmpereStoredPrice[]
  created: number
  updated: number
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

async function requireAmpereClientId(): Promise<string> {
  const catalog = await getActiveCatalogProvider()
  if (catalog !== "ampere") throw new AmpereCatalogDisabledError()
  return getActiveClientId()
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: string }).name === "ConditionalCheckFailedException"
  )
}

function readMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry
  }
  return out
}

function readPrice(value: unknown): AmpereStoredPrice | null {
  if (!value || typeof value !== "object") return null
  const price = value as Record<string, unknown>
  if (typeof price.id !== "string") return null
  if (!price.id.startsWith(AMPERE_SK_PREFIX.price)) return null
  if (typeof price.currency !== "string") return null
  if (typeof price.unitAmount !== "number" || !Number.isFinite(price.unitAmount)) {
    return null
  }
  const type = price.type === "recurring" ? "recurring" : "one_time"
  const interval =
    price.interval === "day" ||
    price.interval === "week" ||
    price.interval === "month" ||
    price.interval === "year"
      ? price.interval
      : undefined
  return {
    id: price.id,
    active: price.active !== false,
    currency: price.currency,
    unitAmount: price.unitAmount,
    type,
    ...(type === "recurring"
      ? {
          interval: interval ?? "month",
          intervalCount:
            typeof price.intervalCount === "number" ? price.intervalCount : 1,
        }
      : {}),
    ...(typeof price.nickname === "string" && price.nickname
      ? { nickname: price.nickname }
      : {}),
    created: typeof price.created === "number" ? price.created : 0,
  }
}

/** Coerce a DynamoDB item into an Ampere product, or null when it is not one. */
export function readAmpereStoredProduct(
  item: Record<string, unknown>
): AmpereStoredProduct | null {
  if (typeof item.id !== "string") return null
  if (!item.id.startsWith(AMPERE_SK_PREFIX.product)) return null
  if (typeof item.client_id !== "string") return null
  const prices = Array.isArray(item.prices)
    ? item.prices
        .map(readPrice)
        .filter((price): price is AmpereStoredPrice => price !== null)
    : []
  const defaultPriceId =
    typeof item.defaultPriceId === "string" ? item.defaultPriceId : null
  return {
    client_id: item.client_id,
    id: item.id,
    kind: "ampere_product",
    name: typeof item.name === "string" ? item.name : "",
    description: typeof item.description === "string" ? item.description : "",
    active: item.active !== false,
    images: Array.isArray(item.images)
      ? item.images.filter((url): url is string => typeof url === "string")
      : [],
    metadata: readMetadata(item.metadata),
    defaultPriceId,
    prices,
    created: typeof item.created === "number" ? item.created : 0,
    updated: typeof item.updated === "number" ? item.updated : 0,
  }
}

function toPriceView(
  price: AmpereStoredPrice,
  defaultPriceId: string | null
): StripePriceView {
  return {
    id: price.id,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unitAmount,
    type: price.type,
    interval: price.interval,
    intervalCount: price.intervalCount,
    nickname: price.nickname,
    created: price.created,
    isDefault: price.id === defaultPriceId,
  }
}

export function toAmperePriceViews(
  product: AmpereStoredProduct
): StripePriceView[] {
  return product.prices
    .map((price) => toPriceView(price, product.defaultPriceId))
    .sort((a, b) => b.created - a.created)
}

export function toAmpereProductView(
  product: AmpereStoredProduct
): StripeProductView {
  const defaultPrice =
    product.prices.find((price) => price.id === product.defaultPriceId) ?? null
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    active: product.active,
    images: product.images,
    metadata: product.metadata,
    defaultPriceId: defaultPrice ? product.defaultPriceId : null,
    defaultPrice: defaultPrice
      ? toPriceView(defaultPrice, product.defaultPriceId)
      : null,
    created: product.created,
    updated: product.updated,
  }
}

export function collectMetadataSuggestions(
  products: Array<{ metadata?: Record<string, string> | null }>
): MetadataSuggestions {
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

export function buildStoredPrice(
  input: StripePriceCreateInput,
  created = nowUnix()
): AmpereStoredPrice {
  return {
    id: `${AMPERE_SK_PREFIX.price}${uuidv4()}`,
    active: true,
    currency: input.currency,
    unitAmount: input.unitAmount,
    type: input.type,
    ...(input.type === "recurring"
      ? {
          interval: input.interval ?? "month",
          intervalCount: input.intervalCount ?? 1,
        }
      : {}),
    ...(input.nickname ? { nickname: input.nickname } : {}),
    created,
  }
}

async function getStored(
  clientId: string,
  id: string
): Promise<AmpereStoredProduct | null> {
  if (!id.startsWith(AMPERE_SK_PREFIX.product)) return null
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  return res.Item ? readAmpereStoredProduct(res.Item) : null
}

async function listStored(clientId: string): Promise<AmpereStoredProduct[]> {
  const items: AmpereStoredProduct[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new QueryCommand({
        TableName: CONTENT_TABLE,
        KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
        ExpressionAttributeValues: {
          ":cid": clientId,
          ":prefix": AMPERE_SK_PREFIX.product,
        },
        ExclusiveStartKey: startKey,
      })
    )
    for (const raw of res.Items ?? []) {
      const product = readAmpereStoredProduct(raw)
      if (product) items.push(product)
    }
    startKey = res.LastEvaluatedKey
  } while (startKey)

  return items
}

async function mutateProduct(
  clientId: string,
  id: string,
  mutate: (product: AmpereStoredProduct) => AmpereStoredProduct
): Promise<AmpereStoredProduct> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await getStored(clientId, id)
    if (!current) throw new AmpereProductNotFoundError()
    const next = mutate(current)
    next.client_id = clientId
    next.id = current.id
    next.kind = "ampere_product"
    next.created = current.created
    next.updated = nowUnix()
    try {
      await getDynamo().send(
        new PutCommand({
          TableName: CONTENT_TABLE,
          Item: next,
          ConditionExpression: "updated = :expected AND client_id = :cid",
          ExpressionAttributeValues: {
            ":expected": current.updated,
            ":cid": clientId,
          },
        })
      )
      return next
    } catch (err) {
      if (!isConditionalCheckFailed(err)) throw err
    }
  }
  throw new Error("Could not save this product. Try again.")
}

export async function listAmpereProducts(): Promise<StripeProductView[]> {
  const clientId = await requireAmpereClientId()
  const products = await listStored(clientId)
  return products
    .map(toAmpereProductView)
    .sort((a, b) => b.created - a.created)
}

export async function getAmpereProduct(
  id: string
): Promise<StripeProductView | null> {
  const clientId = await requireAmpereClientId()
  const product = await getStored(clientId, id)
  return product ? toAmpereProductView(product) : null
}

export async function getAmpereMetadataSuggestions(): Promise<MetadataSuggestions> {
  const clientId = await requireAmpereClientId()
  const products = await listStored(clientId)
  return collectMetadataSuggestions(products)
}

export async function createAmpereProduct(
  input: AmpereProductCreateInput
): Promise<StripeProductView> {
  const clientId = await requireAmpereClientId()
  const now = nowUnix()
  const price = input.defaultPrice ? buildStoredPrice(input.defaultPrice, now) : null
  const item: AmpereStoredProduct = {
    client_id: clientId,
    id: `${AMPERE_SK_PREFIX.product}${uuidv4()}`,
    kind: "ampere_product",
    name: input.name,
    description: input.description,
    active: input.active,
    images: input.images,
    metadata: input.metadata,
    defaultPriceId: price?.id ?? null,
    prices: price ? [price] : [],
    created: now,
    updated: now,
  }
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(id)",
    })
  )
  return toAmpereProductView(item)
}

export async function updateAmpereProduct(
  id: string,
  input: AmpereProductUpdateInput
): Promise<StripeProductView> {
  const clientId = await requireAmpereClientId()
  const next = await mutateProduct(clientId, id, (current) => {
    const updated: AmpereStoredProduct = { ...current }
    if (input.name !== undefined) updated.name = input.name
    if (input.description !== undefined) updated.description = input.description
    if (input.active !== undefined) updated.active = input.active
    if (input.images !== undefined) updated.images = input.images
    if (input.metadata !== undefined) updated.metadata = input.metadata
    if (input.defaultPriceId !== undefined) {
      if (input.defaultPriceId === null) {
        updated.defaultPriceId = null
      } else {
        const price = current.prices.find(
          (entry) => entry.id === input.defaultPriceId
        )
        if (!price) {
          throw new AmpereValidationError("That price is not on this product")
        }
        if (!price.active) {
          throw new AmpereValidationError(
            "Archived prices cannot be the default"
          )
        }
        updated.defaultPriceId = price.id
      }
    }
    return updated
  })
  return toAmpereProductView(next)
}

/** Match the Stripe builder: archive hides the product instead of deleting it. */
export async function archiveAmpereProduct(
  id: string
): Promise<StripeProductView> {
  const clientId = await requireAmpereClientId()
  const next = await mutateProduct(clientId, id, (current) => ({
    ...current,
    active: false,
  }))
  return toAmpereProductView(next)
}

export async function listAmperePrices(
  productId: string
): Promise<StripePriceView[]> {
  const clientId = await requireAmpereClientId()
  const product = await getStored(clientId, productId)
  if (!product) return []
  return toAmperePriceViews(product)
}

export async function createAmperePrice(
  productId: string,
  input: StripePriceCreateInput
): Promise<StripePriceView> {
  const clientId = await requireAmpereClientId()
  const price = buildStoredPrice(input)
  const next = await mutateProduct(clientId, productId, (current) => ({
    ...current,
    prices: [...current.prices, price],
  }))
  return toPriceView(price, next.defaultPriceId)
}

export async function setAmperePriceActive(
  priceId: string,
  active: boolean
): Promise<StripePriceView> {
  const clientId = await requireAmpereClientId()
  if (!priceId.startsWith(AMPERE_SK_PREFIX.price)) {
    throw new AmpereProductNotFoundError()
  }
  const products = await listStored(clientId)
  const owner = products.find((product) =>
    product.prices.some((price) => price.id === priceId)
  )
  if (!owner) throw new AmpereProductNotFoundError()
  const next = await mutateProduct(clientId, owner.id, (current) => ({
    ...current,
    prices: current.prices.map((price) =>
      price.id === priceId ? { ...price, active } : price
    ),
  }))
  const updated = next.prices.find((price) => price.id === priceId)
  if (!updated) throw new AmpereProductNotFoundError()
  return toPriceView(updated, next.defaultPriceId)
}

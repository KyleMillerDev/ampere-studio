/**
 * Square mirror read/write helpers.
 *
 * All Square data is stored in Ampere-Studio-Content (the same DynamoDB table
 * used for custom catalog data) with `client_id` as PK and a prefixed SK.
 * Published products: sqprod_<rawId>
 * Draft products:     sqproddraft_<rawId>
 *
 * Read paths query the mirror only. Write paths call Square first, then
 * update the mirror. The mirror is the single source of truth for the UI.
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { CONTENT_TABLE, SQUARE_SK_PREFIX } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import type {
  CatalogModifierList,
  ItemOption,
  SquareMirrorCategory,
  SquareMirrorDiscount,
  SquareMirrorProduct,
  SquareOptionPreset,
  SquareOrder,
  SquareSyncMeta,
} from "@/lib/square/types"

// ─── SK helpers ──────────────────────────────────────────────────────────────

export function productSK(rawId: string, isDraft: boolean): string {
  return isDraft
    ? `${SQUARE_SK_PREFIX.productDraft}${rawId}`
    : `${SQUARE_SK_PREFIX.product}${rawId}`
}
export function categorySK(rawId: string): string {
  return `${SQUARE_SK_PREFIX.category}${rawId}`
}
export function discountSK(rawId: string): string {
  return `${SQUARE_SK_PREFIX.discount}${rawId}`
}
export function optionSK(rawId: string): string {
  return `${SQUARE_SK_PREFIX.option}${rawId}`
}
export function modifierListSK(rawId: string): string {
  return `${SQUARE_SK_PREFIX.modifierList}${rawId}`
}
export function optionPresetSK(rawId: string): string {
  return `${SQUARE_SK_PREFIX.optionPreset}${rawId}`
}
export function orderSK(rawId: string): string {
  return `${SQUARE_SK_PREFIX.order}${rawId}`
}

export function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "--")
    .replace(/#/g, "num.")
    .replace(/[^a-z0-9_\-\.]/g, "")
}

// ─── Sync watermark ───────────────────────────────────────────────────────────

export async function getSyncMeta(
  clientId: string
): Promise<SquareSyncMeta | null> {
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: SQUARE_SK_PREFIX.syncMeta },
    })
  )
  if (!res.Item) return null
  return res.Item as SquareSyncMeta
}

export async function putSyncMeta(
  clientId: string,
  refreshedAt: string
): Promise<void> {
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        client_id: clientId,
        id: SQUARE_SK_PREFIX.syncMeta,
        refreshed_at: refreshedAt,
      },
    })
  )
}

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * List all mirrored products (published + draft) for a client.
 */
export async function listMirrorProducts(
  clientId: string
): Promise<SquareMirrorProduct[]> {
  const [published, drafts] = await Promise.all([
    queryByPrefix<SquareMirrorProduct>(clientId, SQUARE_SK_PREFIX.product),
    queryByPrefix<SquareMirrorProduct>(clientId, SQUARE_SK_PREFIX.productDraft),
  ])
  return [...published, ...drafts]
}

/**
 * List only published (non-draft) products.
 */
export async function listPublishedMirrorProducts(
  clientId: string
): Promise<SquareMirrorProduct[]> {
  return queryByPrefix<SquareMirrorProduct>(clientId, SQUARE_SK_PREFIX.product)
}

export async function getMirrorProduct(
  clientId: string,
  rawId: string
): Promise<SquareMirrorProduct | null> {
  // Try published first, then draft
  for (const sk of [productSK(rawId, false), productSK(rawId, true)]) {
    const res = await getDynamo().send(
      new GetCommand({
        TableName: CONTENT_TABLE,
        Key: { client_id: clientId, id: sk },
      })
    )
    if (res.Item) return res.Item as SquareMirrorProduct
  }
  return null
}

export async function putMirrorProduct(
  product: SquareMirrorProduct
): Promise<void> {
  await getDynamo().send(
    new PutCommand({ TableName: CONTENT_TABLE, Item: product })
  )
}

/**
 * Swap a product's prefix when its published/draft status changes.
 * Deletes the old-prefix row and writes the new-prefix row atomically.
 */
export async function swapProductPrefix(
  clientId: string,
  rawId: string,
  newProduct: SquareMirrorProduct
): Promise<void> {
  const oldSK = productSK(rawId, newProduct.type === "sqprod")
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: oldSK },
    })
  )
  await getDynamo().send(
    new PutCommand({ TableName: CONTENT_TABLE, Item: newProduct })
  )
}

export async function deleteMirrorProduct(
  clientId: string,
  rawId: string
): Promise<void> {
  await Promise.all([
    getDynamo().send(
      new DeleteCommand({
        TableName: CONTENT_TABLE,
        Key: { client_id: clientId, id: productSK(rawId, false) },
      })
    ),
    getDynamo().send(
      new DeleteCommand({
        TableName: CONTENT_TABLE,
        Key: { client_id: clientId, id: productSK(rawId, true) },
      })
    ),
  ])
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listMirrorCategories(
  clientId: string
): Promise<SquareMirrorCategory[]> {
  return queryByPrefix<SquareMirrorCategory>(
    clientId,
    SQUARE_SK_PREFIX.category
  )
}

export async function getMirrorCategory(
  clientId: string,
  rawId: string
): Promise<SquareMirrorCategory | null> {
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: categorySK(rawId) },
    })
  )
  return res.Item ? (res.Item as SquareMirrorCategory) : null
}

export async function putMirrorCategory(
  cat: SquareMirrorCategory
): Promise<void> {
  await getDynamo().send(
    new PutCommand({ TableName: CONTENT_TABLE, Item: cat })
  )
}

export async function deleteMirrorCategory(
  clientId: string,
  rawId: string
): Promise<void> {
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: categorySK(rawId) },
    })
  )
}

// ─── Discounts ────────────────────────────────────────────────────────────────

export async function listMirrorDiscounts(
  clientId: string
): Promise<SquareMirrorDiscount[]> {
  return queryByPrefix<SquareMirrorDiscount>(
    clientId,
    SQUARE_SK_PREFIX.discount
  )
}

export async function getMirrorDiscount(
  clientId: string,
  rawId: string
): Promise<SquareMirrorDiscount | null> {
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: discountSK(rawId) },
    })
  )
  return res.Item ? (res.Item as SquareMirrorDiscount) : null
}

export async function putMirrorDiscount(
  discount: SquareMirrorDiscount
): Promise<void> {
  await getDynamo().send(
    new PutCommand({ TableName: CONTENT_TABLE, Item: discount })
  )
}

export async function deleteMirrorDiscount(
  clientId: string,
  rawId: string
): Promise<void> {
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: discountSK(rawId) },
    })
  )
}

// ─── Item Options (catalog objects) ──────────────────────────────────────────

export async function listMirrorOptions(
  clientId: string
): Promise<ItemOption[]> {
  return queryByPrefix<ItemOption>(clientId, SQUARE_SK_PREFIX.option)
}

export async function putMirrorOption(
  clientId: string,
  option: ItemOption & { id: string }
): Promise<void> {
  const rawId = option.id
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        ...option,
        client_id: clientId,
        id: optionSK(rawId),
        raw_id: rawId,
        type: "sqoption",
      },
    })
  )
}

// ─── Modifier Lists (catalog objects) ────────────────────────────────────────

export async function listMirrorModifierLists(
  clientId: string
): Promise<CatalogModifierList[]> {
  return queryByPrefix<CatalogModifierList>(
    clientId,
    SQUARE_SK_PREFIX.modifierList
  )
}

export async function putMirrorModifierList(
  clientId: string,
  ml: CatalogModifierList
): Promise<void> {
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        ...ml,
        client_id: clientId,
        id: modifierListSK(ml.id),
        raw_id: ml.id,
        type: "sqmodlist",
      },
    })
  )
}

export async function deleteMirrorModifierList(
  clientId: string,
  rawId: string
): Promise<void> {
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: modifierListSK(rawId) },
    })
  )
}

// ─── Option presets (CMS-only) ────────────────────────────────────────────────

export async function listMirrorOptionPresets(
  clientId: string
): Promise<SquareOptionPreset[]> {
  return queryByPrefix<SquareOptionPreset>(
    clientId,
    SQUARE_SK_PREFIX.optionPreset
  )
}

export async function getMirrorOptionPreset(
  clientId: string,
  rawId: string
): Promise<SquareOptionPreset | null> {
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: optionPresetSK(rawId) },
    })
  )
  return res.Item ? (res.Item as SquareOptionPreset) : null
}

export async function putMirrorOptionPreset(
  preset: SquareOptionPreset
): Promise<void> {
  await getDynamo().send(
    new PutCommand({ TableName: CONTENT_TABLE, Item: preset })
  )
}

export async function deleteMirrorOptionPreset(
  clientId: string,
  rawId: string
): Promise<void> {
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: optionPresetSK(rawId) },
    })
  )
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function listMirrorOrders(
  clientId: string,
  opts?: { limit?: number }
): Promise<SquareOrder[]> {
  const orders = await queryByPrefix<SquareOrder>(
    clientId,
    SQUARE_SK_PREFIX.order
  )
  // Sort newest-first
  orders.sort((a, b) => {
    const ta = a.created_at ?? ""
    const tb = b.created_at ?? ""
    return tb.localeCompare(ta)
  })
  if (opts?.limit) return orders.slice(0, opts.limit)
  return orders
}

export async function getMirrorOrder(
  clientId: string,
  rawId: string
): Promise<SquareOrder | null> {
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id: orderSK(rawId) },
    })
  )
  return res.Item ? (res.Item as SquareOrder) : null
}

export async function putMirrorOrder(
  clientId: string,
  order: SquareOrder
): Promise<void> {
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        ...order,
        client_id: clientId,
        id: orderSK(order.id),
        raw_id: order.id,
        type: "sqorder",
      },
    })
  )
}

// ─── Generic query by SK prefix ──────────────────────────────────────────────

async function queryByPrefix<T>(
  clientId: string,
  prefix: string
): Promise<T[]> {
  const items: T[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new QueryCommand({
        TableName: CONTENT_TABLE,
        KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
        ExpressionAttributeValues: { ":cid": clientId, ":prefix": prefix },
        ExclusiveStartKey: lastKey,
      })
    )
    for (const item of res.Items ?? []) items.push(item as T)
    lastKey = res.LastEvaluatedKey
  } while (lastKey)

  return items
}

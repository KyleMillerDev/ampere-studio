/**
 * Square → DynamoDB mirror sync engine.
 *
 * Two sync modes:
 *  - incrementalRefresh: fetch only catalog changes since the stored watermark.
 *    Called on every dashboard page load. Fast.
 *  - fullRebuild: fetch ALL catalog data, inventory, orders, and write the
 *    entire mirror. Used once during setup (via scripts/square-full-sync.ts).
 */

import { SquareClient } from "square"

import {
  categorySK,
  deleteMirrorCategory,
  deleteMirrorModifierList,
  deleteMirrorProduct,
  getSyncMeta,
  modifierListSK,
  optionSK,
  productSK,
  putMirrorCategory,
  putMirrorModifierList,
  putMirrorOption,
  putMirrorOrder,
  putMirrorProduct,
  putSyncMeta,
  swapProductPrefix,
  toSlug,
} from "@/lib/square/mirror"
import type {
  CatalogCategoryData,
  CatalogDiscount,
  CatalogItemData,
  CatalogItemVariation,
  CatalogModifierList,
  CatalogPricingRule,
  CatalogProductSet,
  ItemOption,
  SquareMirrorCategory,
  SquareMirrorDiscount,
  SquareMirrorProduct,
  SquareOrder,
} from "@/lib/square/types"
import { CONTENT_TABLE, SQUARE_SK_PREFIX } from "@/lib/cms/constants"
import { getDynamo } from "@/lib/aws/dynamo"
import { PutCommand } from "@aws-sdk/lib-dynamodb"

// ─── SDK normalization ────────────────────────────────────────────────────────
// Square SDK v45 returns camelCase property names and bigint money values.
// Convert to snake_case + number so the rest of the sync logic (which uses
// the snake_case mirror types) works without modification.

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`)
}

export function sdkToSnake(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value)
  if (value === null || value === undefined) return value
  if (typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sdkToSnake)
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[camelToSnake(k)] = sdkToSnake(v)
  }
  return result
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isPricingRuleActive(rule: CatalogPricingRule): boolean {
  const data = rule.pricing_rule_data
  if (data.disabled_pricing_sources?.includes("SQUARE_ONLINE")) return false
  const now = new Date()
  if (data.valid_from_date && data.valid_from_local_time) {
    const start = new Date(
      `${data.valid_from_date}T${data.valid_from_local_time}`
    )
    if (now < start) return false
  }
  if (data.valid_until_date && data.valid_until_local_time) {
    const end = new Date(
      `${data.valid_until_date}T${data.valid_until_local_time}`
    )
    if (now > end) return false
  }
  return true
}

function buildDiscountGraph(
  discounts: CatalogDiscount[],
  pricingRules: CatalogPricingRule[],
  productSets: CatalogProductSet[]
): {
  activeRules: CatalogPricingRule[]
  productSetMap: Map<string, string[]>
  discountMap: Map<string, CatalogDiscount>
} {
  const discountMap = new Map<string, CatalogDiscount>()
  for (const d of discounts) discountMap.set(d.id, d)

  const productSetMap = new Map<string, string[]>()
  for (const ps of productSets) {
    const ids =
      ps.product_set_data.product_ids_any ??
      ps.product_set_data.product_ids_all ??
      []
    if (ids.length > 0) productSetMap.set(ps.id, ids)
  }

  const activeRules = pricingRules.filter(isPricingRuleActive)
  return { activeRules, productSetMap, discountMap }
}

function computeItemDiscount(
  itemId: string,
  firstVariationPrice: number,
  activeRules: CatalogPricingRule[],
  productSetMap: Map<string, string[]>,
  discountMap: Map<string, CatalogDiscount>
): { km_discount_amount: number; pricing_rule?: CatalogPricingRule } {
  let topDiscount = 0
  let chosenRule: CatalogPricingRule | undefined

  for (const rule of activeRules) {
    const psId = rule.pricing_rule_data.match_products_id
    if (!psId) continue
    const productIds = productSetMap.get(psId)
    if (!productIds) continue
    if (!productIds.includes(itemId) && !productIds.includes("*")) continue

    const discId = rule.pricing_rule_data.discount_id
    if (!discId) continue
    const disc = discountMap.get(discId)
    if (!disc) continue

    let amount = 0
    if (disc.discount_data.amount_money) {
      amount = disc.discount_data.amount_money.amount
    } else if (disc.discount_data.percentage) {
      const pct = parseFloat(disc.discount_data.percentage)
      amount = Math.round((firstVariationPrice * pct) / 100)
    }
    if (amount > topDiscount) {
      topDiscount = amount
      chosenRule = rule
    }
  }

  return { km_discount_amount: topDiscount, pricing_rule: chosenRule }
}

function resolveImageUrls(
  imageIds: string[] | undefined,
  imageMap: Map<string, string>
): string[] {
  return (imageIds ?? []).flatMap((id) => {
    const url = imageMap.get(id)
    return url ? [url] : []
  })
}

async function fetchAllCatalogPages(
  client: SquareClient,
  types: string
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  const page = await client.catalog.list({ types })
  for await (const item of page) {
    items.push(sdkToSnake(item) as Record<string, unknown>)
  }
  return items
}

async function fetchInventory(
  client: SquareClient,
  variationIds: string[]
): Promise<Map<string, string>> {
  if (variationIds.length === 0) return new Map()
  const counts = new Map<string, string>()
  const page = await client.inventory.batchGetCounts({
    catalogObjectIds: variationIds,
  })
  for await (const count of page) {
    const c = count as { catalogObjectId?: string; quantity?: string }
    if (c.catalogObjectId && c.quantity !== undefined) {
      counts.set(c.catalogObjectId, c.quantity)
    }
  }
  return counts
}

async function fetchImages(
  client: SquareClient,
  imageIds: string[]
): Promise<Map<string, string>> {
  if (imageIds.length === 0) return new Map()
  const urlMap = new Map<string, string>()
  // Square batch retrieve handles up to 1000 IDs per call
  const BATCH = 1000
  for (let i = 0; i < imageIds.length; i += BATCH) {
    const batch = imageIds.slice(i, i + BATCH)
    try {
      const res = await client.catalog.batchGet({ objectIds: batch })
      for (const obj of res.objects ?? []) {
        const o = sdkToSnake(obj) as {
          id?: string
          image_data?: { url?: string }
        }
        if (o.id && o.image_data?.url) urlMap.set(o.id, o.image_data.url)
      }
    } catch {
      // Non-fatal; images just won't resolve
    }
  }
  return urlMap
}

// ─── Mirror enrichment helpers ────────────────────────────────────────────────

function enrichItem(
  raw: Record<string, unknown>,
  {
    imageMap,
    inventoryMap,
    itemOptionsMap,
    modifierListsMap,
    activeRules,
    productSetMap,
    discountMap,
  }: {
    imageMap: Map<string, string>
    inventoryMap: Map<string, string>
    itemOptionsMap: Map<string, ItemOption>
    modifierListsMap: Map<string, CatalogModifierList>
    activeRules: CatalogPricingRule[]
    productSetMap: Map<string, string[]>
    discountMap: Map<string, CatalogDiscount>
  }
): SquareMirrorProduct {
  const id = raw.id as string
  const itemData = (raw.item_data ?? {}) as CatalogItemData &
    Record<string, unknown>
  // Draft: item is archived OR not visible on the online store
  // ecom_visibility can be "VISIBLE" | "UNAVAILABLE" | "HIDDEN"
  const ecomVis = (itemData as Record<string, unknown>).ecom_visibility as
    | string
    | undefined
  const isDraft =
    Boolean(itemData.is_archived) ||
    (ecomVis !== undefined && ecomVis !== "VISIBLE")
  const slug = toSlug(itemData.name ?? id)

  // Resolve top-level item images
  const topImageUrls = resolveImageUrls(
    itemData.image_ids as string[] | undefined,
    imageMap
  )
  if (topImageUrls.length)
    (itemData as Record<string, unknown>).image_urls = topImageUrls

  // Collect variation image ids and inventory; gather option references
  const inventoryCheckIds: string[] = []
  const resolvedOptions: ItemOption[] = []
  const seenOptionIds = new Set<string>()

  const variations = (itemData.variations ?? []) as CatalogItemVariation[]
  for (const v of variations) {
    const vd = v.item_variation_data
    if (vd.track_inventory) inventoryCheckIds.push(v.id)
    const vImgs = resolveImageUrls(vd.image_ids, imageMap)
    if (vImgs.length)
      (v.item_variation_data as Record<string, unknown>).image_urls = vImgs

    for (const optVal of vd.item_option_values ?? []) {
      const optId = optVal.item_option_id
      if (optId && !seenOptionIds.has(optId)) {
        seenOptionIds.add(optId)
        const opt = itemOptionsMap.get(optId)
        if (opt) resolvedOptions.push(opt)
      }
    }
  }

  // Resolve inventory from pre-fetched map
  for (const v of variations) {
    const qty = inventoryMap.get(v.id)
    if (qty !== undefined)
      (v.item_variation_data as Record<string, unknown>).km_inventory = qty
  }

  // Compute discount
  const firstPrice =
    variations[0]?.item_variation_data?.price_money?.amount ?? 0
  const { km_discount_amount, pricing_rule } = computeItemDiscount(
    id,
    firstPrice,
    activeRules,
    productSetMap,
    discountMap
  )
  ;(itemData as Record<string, unknown>).km_discount_amount = km_discount_amount

  // Resolve modifier lists
  const modifierListInfo = (itemData as Record<string, unknown>)
    .modifier_list_info as Array<{ modifier_list_id: string }> | undefined
  const resolvedModifierLists: CatalogModifierList[] = []
  for (const mli of modifierListInfo ?? []) {
    const ml = modifierListsMap.get(mli.modifier_list_id)
    if (ml) resolvedModifierLists.push(ml)
  }

  return {
    client_id: "",
    id: productSK(id, isDraft),
    raw_id: id,
    type: isDraft ? "sqproddraft" : "sqprod",
    slug,
    version: raw.version as number | undefined,
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
    item_data: itemData as CatalogItemData,
    options: resolvedOptions.length ? resolvedOptions : undefined,
    modifier_lists: resolvedModifierLists.length
      ? resolvedModifierLists
      : undefined,
    pricing_rule,
    km_status: isDraft ? "Draft" : "Published",
    custom_attribute_values:
      raw.custom_attribute_values as SquareMirrorProduct["custom_attribute_values"],
  }
}

function enrichCategory(
  raw: Record<string, unknown>,
  productsByCategoryId: Map<string, string[]>,
  imageMap: Map<string, string>
): SquareMirrorCategory {
  const id = raw.id as string
  const catData = (raw.category_data ?? {}) as CatalogCategoryData &
    Record<string, unknown>
  const isArchived = Boolean(catData.is_archived)
  const imgUrls = resolveImageUrls(
    catData.image_ids as string[] | undefined,
    imageMap
  )
  if (imgUrls.length) catData.image_urls = imgUrls
  const productIds = productsByCategoryId.get(id) ?? []
  if (productIds.length) catData.km_product_ids = productIds

  return {
    client_id: "",
    id: categorySK(id),
    raw_id: id,
    type: "sqcat",
    slug: toSlug(catData.name ?? id),
    version: raw.version as number | undefined,
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
    category_data: catData as CatalogCategoryData,
    km_status: isArchived ? "Draft" : "Published",
  }
}

// ─── Full rebuild ─────────────────────────────────────────────────────────────

export interface FullRebuildResult {
  items: number
  categories: number
  discounts: number
  options: number
  modifierLists: number
  orders: number
  errors: string[]
}

export async function fullRebuild(
  client: SquareClient,
  clientId: string,
  locationId: string
): Promise<FullRebuildResult> {
  const errors: string[] = []

  console.log(`[square-sync] Starting full rebuild for client=${clientId}`)

  // 1. Fetch ALL catalog objects
  const allRaw = await fetchAllCatalogPages(
    client,
    "ITEM,CATEGORY,PRICING_RULE,DISCOUNT,PRODUCT_SET,ITEM_OPTION,MODIFIER_LIST"
  )

  const items: Record<string, unknown>[] = []
  const categories: Record<string, unknown>[] = []
  const discounts: CatalogDiscount[] = []
  const pricingRules: CatalogPricingRule[] = []
  const productSets: CatalogProductSet[] = []
  const itemOptionsMap = new Map<string, ItemOption>()
  const modifierListsMap = new Map<string, CatalogModifierList>()
  const imageIds = new Set<string>()
  const inventoryCheckIds: string[] = []
  const productsByCategoryId = new Map<string, string[]>()

  for (const raw of allRaw) {
    const type = raw.type as string
    const collectImageIds = (data: Record<string, unknown>) => {
      for (const id of (data.image_ids as string[] | undefined) ?? [])
        imageIds.add(id)
    }

    if (type === "ITEM") {
      const data = raw.item_data as CatalogItemData & Record<string, unknown>
      items.push(raw)
      collectImageIds(data as Record<string, unknown>)
      for (const v of (data.variations ?? []) as CatalogItemVariation[]) {
        if (v.item_variation_data.track_inventory) inventoryCheckIds.push(v.id)
        collectImageIds(
          v.item_variation_data as unknown as Record<string, unknown>
        )
      }
      for (const cat of data.categories ?? []) {
        const arr = productsByCategoryId.get(cat.id) ?? []
        arr.push(raw.id as string)
        productsByCategoryId.set(cat.id, arr)
      }
    } else if (type === "CATEGORY") {
      const data = raw.category_data as CatalogCategoryData &
        Record<string, unknown>
      categories.push(raw)
      collectImageIds(data as Record<string, unknown>)
    } else if (type === "DISCOUNT") {
      discounts.push(raw as unknown as CatalogDiscount)
    } else if (type === "PRICING_RULE") {
      pricingRules.push(raw as unknown as CatalogPricingRule)
    } else if (type === "PRODUCT_SET") {
      productSets.push(raw as unknown as CatalogProductSet)
    } else if (type === "ITEM_OPTION") {
      itemOptionsMap.set(raw.id as string, raw as unknown as ItemOption)
    } else if (type === "MODIFIER_LIST") {
      modifierListsMap.set(
        raw.id as string,
        raw as unknown as CatalogModifierList
      )
    }
  }

  // 2. Batch fetch images and inventory
  const [imageMap, inventoryMap] = await Promise.all([
    fetchImages(client, Array.from(imageIds)),
    fetchInventory(client, inventoryCheckIds),
  ])

  // 3. Build discount graph
  const { activeRules, productSetMap, discountMap } = buildDiscountGraph(
    discounts,
    pricingRules,
    productSets
  )

  // 4. Write items to mirror (all, including drafts/non-visible)
  // Always delete the opposite-prefix SK first to avoid stale rows when an
  // item's published/draft status changed since the last full rebuild.
  let itemCount = 0
  for (const raw of items) {
    try {
      const product = enrichItem(raw, {
        imageMap,
        inventoryMap,
        itemOptionsMap,
        modifierListsMap,
        activeRules,
        productSetMap,
        discountMap,
      })
      product.client_id = clientId
      await swapProductPrefix(clientId, product.raw_id, product)
      itemCount++
    } catch (err) {
      errors.push(`Item ${raw.id}: ${String(err)}`)
    }
  }

  // 5. Write categories
  let catCount = 0
  for (const raw of categories) {
    try {
      const cat = enrichCategory(raw, productsByCategoryId, imageMap)
      cat.client_id = clientId
      await putMirrorCategory(cat)
      catCount++
    } catch (err) {
      errors.push(`Category ${raw.id}: ${String(err)}`)
    }
  }

  // 6. Write item options
  for (const [optId, option] of itemOptionsMap) {
    try {
      await putMirrorOption(clientId, { ...option, id: optId })
    } catch (err) {
      errors.push(`Option ${optId}: ${String(err)}`)
    }
  }

  // 7. Write modifier lists
  for (const [mlId, ml] of modifierListsMap) {
    try {
      await putMirrorModifierList(clientId, ml)
    } catch (err) {
      errors.push(`ModifierList ${mlId}: ${String(err)}`)
    }
  }

  // 8. Write assembled discount bundles
  let discountCount = 0
  for (const disc of discounts) {
    try {
      const rule = pricingRules.find(
        (r) => r.pricing_rule_data.discount_id === disc.id
      )
      const ps = rule?.pricing_rule_data.match_products_id
        ? productSets.find(
            (p) => p.id === rule.pricing_rule_data.match_products_id
          )
        : undefined
      const targetProductIds = ps
        ? (ps.product_set_data.product_ids_any ??
          ps.product_set_data.product_ids_all ??
          [])
        : []

      const mirrorDiscount: SquareMirrorDiscount = {
        client_id: clientId,
        id: `${SQUARE_SK_PREFIX.discount}${disc.id}`,
        raw_id: disc.id,
        type: "sqdiscount",
        slug: toSlug(disc.discount_data.name),
        discount: disc,
        pricing_rule: rule,
        product_set: ps,
        target_product_ids: targetProductIds,
        target_category_ids: [],
        created_at: disc.created_at ?? new Date().toISOString(),
        updated_at: disc.updated_at ?? new Date().toISOString(),
        is_active: rule ? isPricingRuleActive(rule) : false,
      }
      await getDynamo().send(
        new PutCommand({ TableName: CONTENT_TABLE, Item: mirrorDiscount })
      )
      discountCount++
    } catch (err) {
      errors.push(`Discount ${disc.id}: ${String(err)}`)
    }
  }

  // 9. Fetch and write orders
  let orderCount = 0
  try {
    const ordersResult = await client.orders.search({
      locationIds: [locationId],
      query: {
        sort: { sortField: "CREATED_AT", sortOrder: "DESC" },
      },
      limit: 500,
    })
    for (const orderRaw of ordersResult.orders ?? []) {
      const o = sdkToSnake(orderRaw) as unknown as SquareOrder
      o.km_state = deriveKmOrderState(o)
      await putMirrorOrder(clientId, o)
      orderCount++
    }
  } catch (err) {
    errors.push(`Orders: ${String(err)}`)
  }

  // 10. Write watermark
  await putSyncMeta(clientId, new Date().toISOString())

  console.log(
    `[square-sync] Full rebuild done: ${itemCount} items, ${catCount} cats, ${discountCount} discounts, ${orderCount} orders. Errors: ${errors.length}`
  )

  return {
    items: itemCount,
    categories: catCount,
    discounts: discountCount,
    options: itemOptionsMap.size,
    modifierLists: modifierListsMap.size,
    orders: orderCount,
    errors,
  }
}

// ─── Incremental refresh ──────────────────────────────────────────────────────

export interface IncrementalRefreshResult {
  upserted: number
  deleted: number
  errors: string[]
}

export async function incrementalRefresh(
  client: SquareClient,
  clientId: string,
  locationId: string
): Promise<IncrementalRefreshResult> {
  const errors: string[] = []
  let upserted = 0
  let deleted = 0

  // 1. Read watermark
  const meta = await getSyncMeta(clientId)
  const beginTime = meta?.refreshed_at

  // 2. Fetch catalog changes since the watermark
  const changedRaw: Record<string, unknown>[] = []
  try {
    const searchParams: Record<string, unknown> = {
      objectTypes: [
        "ITEM",
        "CATEGORY",
        "PRICING_RULE",
        "DISCOUNT",
        "PRODUCT_SET",
        "ITEM_OPTION",
        "MODIFIER_LIST",
      ],
      includeRelatedObjects: true,
      includeDeletedObjects: true,
    }
    if (beginTime) searchParams.beginTime = beginTime

    let cursor: string | undefined
    do {
      const res = await client.catalog.search({
        ...searchParams,
        cursor,
      })
      for (const obj of ((res as Record<string, unknown>)
        .objects as unknown[]) ?? []) {
        changedRaw.push(sdkToSnake(obj) as Record<string, unknown>)
      }
      cursor = (res as Record<string, unknown>).cursor as string | undefined
    } while (cursor)
  } catch (err) {
    errors.push(`Catalog search: ${String(err)}`)
    return { upserted, deleted, errors }
  }

  if (changedRaw.length === 0) {
    await putSyncMeta(clientId, new Date().toISOString())
    return { upserted, deleted, errors }
  }

  // 3. Separate by type
  const changedItems: Record<string, unknown>[] = []
  const changedCategories: Record<string, unknown>[] = []
  const deletedIds: string[] = []
  const discounts: CatalogDiscount[] = []
  const pricingRules: CatalogPricingRule[] = []
  const productSets: CatalogProductSet[] = []
  const itemOptionsMap = new Map<string, ItemOption>()
  const modifierListsMap = new Map<string, CatalogModifierList>()
  const imageIds = new Set<string>()
  const inventoryCheckIds: string[] = []

  for (const raw of changedRaw) {
    const type = raw.type as string
    // Only truly deleted objects (is_deleted: true) are removed from the mirror.
    // Archived items (is_archived: true) or non-visible items (ecom_visibility !== VISIBLE)
    // become drafts and flow through changedItems so enrichItem can write them as sqproddraft_.
    const isTrulyDeleted = Boolean(raw.is_deleted)
    const collectImgIds = (data: Record<string, unknown>) => {
      for (const id of (data.image_ids as string[] | undefined) ?? [])
        imageIds.add(id)
    }

    if (type === "ITEM") {
      if (isTrulyDeleted) {
        deletedIds.push(raw.id as string)
      } else {
        changedItems.push(raw)
        const data = raw.item_data as CatalogItemData & Record<string, unknown>
        collectImgIds(data as Record<string, unknown>)
        for (const v of (data.variations ?? []) as CatalogItemVariation[]) {
          if (v.item_variation_data.track_inventory)
            inventoryCheckIds.push(v.id)
          collectImgIds(
            v.item_variation_data as unknown as Record<string, unknown>
          )
        }
      }
    } else if (type === "CATEGORY") {
      if (isTrulyDeleted) {
        deletedIds.push(raw.id as string)
      } else {
        changedCategories.push(raw)
        collectImgIds((raw.category_data ?? {}) as Record<string, unknown>)
      }
    } else if (type === "DISCOUNT") {
      discounts.push(raw as unknown as CatalogDiscount)
    } else if (type === "PRICING_RULE") {
      pricingRules.push(raw as unknown as CatalogPricingRule)
    } else if (type === "PRODUCT_SET") {
      productSets.push(raw as unknown as CatalogProductSet)
    } else if (type === "ITEM_OPTION") {
      if (!raw.is_deleted)
        itemOptionsMap.set(raw.id as string, raw as unknown as ItemOption)
    } else if (type === "MODIFIER_LIST") {
      if (raw.is_deleted) {
        await deleteMirrorModifierList(clientId, raw.id as string)
      } else {
        modifierListsMap.set(
          raw.id as string,
          raw as unknown as CatalogModifierList
        )
      }
    }
  }

  // 4. Handle deletions
  for (const id of deletedIds) {
    try {
      await deleteMirrorProduct(clientId, id)
      await deleteMirrorCategory(clientId, id)
      deleted++
    } catch (err) {
      errors.push(`Delete ${id}: ${String(err)}`)
    }
  }

  if (changedItems.length === 0 && changedCategories.length === 0) {
    await putSyncMeta(clientId, new Date().toISOString())
    return { upserted, deleted, errors }
  }

  // 5. Fetch images and inventory
  const [imageMap, inventoryMap] = await Promise.all([
    fetchImages(client, Array.from(imageIds)),
    fetchInventory(client, inventoryCheckIds),
  ])

  // 6. Build discount graph from changed rules + existing (we need all rules, not just delta)
  // For incremental, rebuild discount graph from the full rules present in the delta batch
  const { activeRules, productSetMap, discountMap } = buildDiscountGraph(
    discounts,
    pricingRules,
    productSets
  )

  // Merge with mirror's existing item options so we can resolve option references
  const existingOptions = await import("@/lib/square/mirror").then((m) =>
    m.listMirrorOptions(clientId)
  )
  for (const opt of existingOptions) {
    const o = opt as ItemOption & { raw_id?: string }
    if (o.id && !itemOptionsMap.has(o.id)) itemOptionsMap.set(o.id, opt)
  }

  // Merge with mirror's existing modifier lists
  const existingMls = await import("@/lib/square/mirror").then((m) =>
    m.listMirrorModifierLists(clientId)
  )
  for (const ml of existingMls) {
    if (!modifierListsMap.has(ml.id)) modifierListsMap.set(ml.id, ml)
  }

  // 7. Rebuild category → product map from changed items only
  const productsByCategoryId = new Map<string, string[]>()
  for (const raw of changedItems) {
    const data = raw.item_data as CatalogItemData
    for (const cat of data.categories ?? []) {
      const arr = productsByCategoryId.get(cat.id) ?? []
      arr.push(raw.id as string)
      productsByCategoryId.set(cat.id, arr)
    }
  }

  // 8. Upsert changed items
  for (const raw of changedItems) {
    try {
      const product = enrichItem(raw, {
        imageMap,
        inventoryMap,
        itemOptionsMap,
        modifierListsMap,
        activeRules,
        productSetMap,
        discountMap,
      })
      product.client_id = clientId

      // If is_archived state changed, swap prefix; otherwise just upsert
      const isDraftNow = product.type === "sqproddraft"
      const otherSK = productSK(product.raw_id, !isDraftNow)
      const { getDynamo: gd } = await import("@/lib/aws/dynamo")
      const { GetCommand: GC } = await import("@aws-sdk/lib-dynamodb")
      const existing = await gd().send(
        new GC({
          TableName: CONTENT_TABLE,
          Key: { client_id: clientId, id: otherSK },
        })
      )
      if (existing.Item) {
        await import("@/lib/square/mirror").then((m) =>
          m.swapProductPrefix(clientId, product.raw_id, product)
        )
      } else {
        await putMirrorProduct(product)
      }
      upserted++
    } catch (err) {
      errors.push(`Item ${raw.id}: ${String(err)}`)
    }
  }

  // 9. Upsert changed categories
  for (const raw of changedCategories) {
    try {
      const cat = enrichCategory(raw, productsByCategoryId, imageMap)
      cat.client_id = clientId
      await putMirrorCategory(cat)
      upserted++
    } catch (err) {
      errors.push(`Category ${raw.id}: ${String(err)}`)
    }
  }

  // 10. Upsert changed options
  for (const [optId, option] of itemOptionsMap) {
    try {
      await putMirrorOption(clientId, { ...option, id: optId })
    } catch (err) {
      errors.push(`Option ${optId}: ${String(err)}`)
    }
  }

  // 11. Upsert changed modifier lists
  for (const [, ml] of modifierListsMap) {
    try {
      await putMirrorModifierList(clientId, ml)
    } catch (err) {
      errors.push(`ModifierList ${ml.id}: ${String(err)}`)
    }
  }

  // 12. Fetch and upsert recent orders (last 24 hours to catch new/updated ones)
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const ordersResult = await client.orders.search({
      locationIds: [locationId],
      query: {
        filter: { dateTimeFilter: { createdAt: { startAt: since } } },
        sort: { sortField: "CREATED_AT", sortOrder: "DESC" },
      },
    })
    for (const orderRaw of ordersResult.orders ?? []) {
      const o = sdkToSnake(orderRaw) as unknown as SquareOrder
      o.km_state = deriveKmOrderState(o)
      await putMirrorOrder(clientId, o)
    }
  } catch (err) {
    errors.push(`Orders refresh: ${String(err)}`)
  }

  // 13. Update watermark
  await putSyncMeta(clientId, new Date().toISOString())

  return { upserted, deleted, errors }
}

// ─── km_state derivation ──────────────────────────────────────────────────────

export function deriveKmOrderState(
  order: SquareOrder
): import("@/lib/square/types").KmOrderState {
  if (order.state === "CANCELED") return "CANCELED"
  if (order.state === "DRAFT") return "ABANDONED_CHECKOUT"

  const fulfillment = order.fulfillments?.[0]
  if (!fulfillment) return order.state === "COMPLETED" ? "COMPLETED" : "OPEN"

  const fState = fulfillment.state
  if (fState === "COMPLETED") return "COMPLETED"
  if (fState === "CANCELED") return "CANCELED"
  if (fState === "RESERVED" || fState === "PREPARED") return "IN_PROGRESS"

  return "OPEN"
}

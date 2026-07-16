/**
 * Square product write-through layer.
 *
 * All writes go to Square first, then update the mirror.
 * Reads always come from the mirror (never direct Square reads in production).
 */

import { randomUUID } from "crypto"

import { requireSquareClient } from "@/lib/square/client"
import { getSquareTokens } from "@/lib/square/config"
import {
  deleteMirrorProduct,
  getMirrorProduct,
  listMirrorProducts,
  productSK,
  putMirrorProduct,
  swapProductPrefix,
  toSlug,
} from "@/lib/square/mirror"
import type {
  CatalogItemData,
  CatalogItemVariation,
  CatalogModifierList,
  ItemOption,
  SquareMirrorProduct,
} from "@/lib/square/types"
import { getActiveClientId } from "@/lib/cms/client-context"
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/lib/validation/square.schema"
import { VARIATION_LIMIT } from "@/lib/validation/square.schema"

// ─── Variation math ───────────────────────────────────────────────────────────

/**
 * Compute the Cartesian product of option values to generate all variation
 * combinations. Returns an array of [ItemOptionValue, ...] tuples.
 */
function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restCombined = cartesian(rest)
  const result: T[][] = []
  for (const a of first) {
    for (const b of restCombined) {
      result.push([a, ...b])
    }
  }
  return result
}

export function computeVariations(
  options: ItemOption[],
  basePriceCents: number,
  itemId: string
): CatalogItemVariation[] {
  if (!options || options.length === 0) {
    return [
      {
        id: `#VAR_DEFAULT`,
        item_variation_data: {
          item_id: itemId,
          name: "Regular",
          pricing_type: "FIXED_PRICING",
          price_money: { amount: basePriceCents, currency: "USD" },
        },
      },
    ]
  }

  const valueCombos = cartesian(options.map((o) => o.item_option_data.values))
  if (valueCombos.length > VARIATION_LIMIT) {
    throw new Error(
      `This combination of options would create ${valueCombos.length} variations, which exceeds the Square limit of ${VARIATION_LIMIT}. Reduce the number of option values.`
    )
  }

  return valueCombos.map((combo, idx) => {
    const names = combo.map((v) => v.item_option_value_data.name)
    const totalMarkup = combo.reduce(
      (sum, v) => sum + (v.item_option_value_data.km_markup ?? 0) * 100,
      0
    )
    const price = Math.max(0, basePriceCents + Math.round(totalMarkup))
    const optionValues = combo.map((v, i) => ({
      item_option_id: options[i].id ?? `#OPT_${i}`,
      item_option_value_id: v.id ?? `#VAL_${i}_${idx}`,
    }))

    return {
      id: `#VAR_${idx}`,
      item_variation_data: {
        item_id: itemId,
        name: names.join(", "),
        ordinal: idx,
        pricing_type: "FIXED_PRICING" as const,
        price_money: { amount: price, currency: "USD" as const },
        item_option_values: optionValues,
      },
    }
  })
}

// ─── Catalog write helpers ────────────────────────────────────────────────────

async function upsertModifierLists(
  squareClient: ReturnType<typeof requireSquareClient> extends Promise<infer T>
    ? T
    : never,
  modifiers: NonNullable<CreateProductInput["modifiers"]>
): Promise<{ id: string; name: string }[]> {
  const results: { id: string; name: string }[] = []

  for (const ml of modifiers) {
    const tempId = `#MODLIST_${randomUUID()}`
    const objects = [
      {
        type: "MODIFIER_LIST" as const,
        id: tempId,
        modifierListData: {
          name: ml.name,
          selectionType: ml.selection_type as "SINGLE" | "MULTIPLE",
          modifiers: ml.modifiers.map((m, idx) => ({
            type: "MODIFIER" as const,
            id: `#MOD_${idx}`,
            modifierData: {
              name: m.name,
              ordinal: m.ordinal ?? idx,
              priceMoney: m.price_cents
                ? { amount: BigInt(m.price_cents), currency: "USD" }
                : undefined,
            },
          })),
        },
      },
    ]

    const res = await squareClient.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [
        {
          objects: objects as Parameters<
            typeof squareClient.catalog.batchUpsert
          >[0]["batches"][0]["objects"],
        },
      ],
    })
    const idMap = res.idMappings ?? []
    const resolved = idMap.find((m) => m.clientObjectId === tempId)
    if (resolved?.objectId) {
      results.push({ id: resolved.objectId, name: ml.name })
    }
  }

  return results
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listSquareProducts(): Promise<SquareMirrorProduct[]> {
  const clientId = await getActiveClientId()
  return listMirrorProducts(clientId)
}

export async function getSquareProduct(
  rawId: string
): Promise<SquareMirrorProduct | null> {
  const clientId = await getActiveClientId()
  return getMirrorProduct(clientId, rawId)
}

export async function createSquareProduct(
  input: CreateProductInput
): Promise<SquareMirrorProduct> {
  const [sq, tokens, clientId] = await Promise.all([
    requireSquareClient(),
    getSquareTokens(),
    getActiveClientId(),
  ])
  if (!tokens) throw new Error("Square not configured")

  const isDraft = input.status === "Draft"
  const itemId = `#ITEM_${randomUUID()}`

  // 1. Upsert any new modifier lists
  let resolvedModifierListIds: string[] = input.modifier_list_ids ?? []
  if (input.modifiers && input.modifiers.length > 0) {
    const newLists = await upsertModifierLists(sq, input.modifiers)
    resolvedModifierListIds = [
      ...resolvedModifierListIds,
      ...newLists.map((m) => m.id),
    ]
  }

  // 2. Compute variations from options
  const options = input.options ?? []
  const variations = computeVariations(options, input.price, itemId)

  // 3. Build catalog objects batch
  const optionObjects = options
    .filter((o) => !o.id || o.id.startsWith("#"))
    .map((o, idx) => ({
      type: "ITEM_OPTION" as const,
      id: `#OPT_${idx}`,
      itemOptionData: {
        name: o.item_option_data.name,
        displayName: o.item_option_data.display_name,
        values: o.item_option_data.values.map((v, vi) => ({
          type: "ITEM_OPTION_VAL" as const,
          id: `#VAL_${idx}_${vi}`,
          itemOptionValueData: {
            name: v.item_option_value_data.name,
            ordinal: v.item_option_value_data.ordinal ?? vi,
          },
        })),
      },
    }))

  const catalogVariations = variations.map((v) => ({
    type: "ITEM_VARIATION" as const,
    id: v.id,
    itemVariationData: {
      name: v.item_variation_data.name,
      pricingType: "FIXED_PRICING" as const,
      priceMoney: {
        amount: BigInt(v.item_variation_data.price_money.amount),
        currency: "USD" as const,
      },
      ordinal: v.item_variation_data.ordinal ?? 0,
      itemOptionValues: (v.item_variation_data.item_option_values ?? []).map(
        (ov) => ({
          itemOptionId: ov.item_option_id,
          itemOptionValueId: ov.item_option_value_id,
        })
      ),
      trackInventory: false,
    },
  }))

  const itemObject = {
    type: "ITEM" as const,
    id: itemId,
    itemData: {
      name: input.name,
      descriptionHtml: input.description_html,
      availableOnline: input.available_online ?? true,
      isArchived: isDraft,
      categoryIds: input.category_ids,
      itemOptions: options.map((_, idx) => ({ itemOptionId: `#OPT_${idx}` })),
      modifierListInfo: resolvedModifierListIds.map((id) => ({
        modifierListId: id,
        enabled: true,
      })),
      variations: catalogVariations,
    },
    customAttributeValues: {
      allow_product_note: {
        booleanValue: input.allow_product_note ?? false,
        customAttributeDefinitionId: "allow_product_note",
      },
      allow_product_personalization: {
        booleanValue: input.allow_product_personalization ?? false,
        customAttributeDefinitionId: "allow_product_personalization",
      },
      allowed_fulfillments: {
        stringValue: input.allowed_fulfillments ?? "PICKUP SHIPPING",
        customAttributeDefinitionId: "allowed_fulfillments",
      },
    },
  }

  const batchObjects = [...optionObjects, itemObject]

  const res = await sq.catalog.batchUpsert({
    idempotencyKey: randomUUID(),
    batches: [{ objects: batchObjects }],
  })

  // 4. Resolve real Square IDs from id mappings
  const idMap = new Map<string, string>()
  for (const mapping of res.idMappings ?? []) {
    if (mapping.clientObjectId && mapping.objectId) {
      idMap.set(mapping.clientObjectId, mapping.objectId)
    }
  }

  const realItemId = idMap.get(itemId) ?? itemId

  // 5. Resolve item_options with real IDs
  const resolvedOptions = options.map((o, idx) => ({
    ...o,
    id: idMap.get(`#OPT_${idx}`) ?? o.id,
    item_option_data: {
      ...o.item_option_data,
      values: o.item_option_data.values.map((v, vi) => ({
        ...v,
        id: idMap.get(`#VAL_${idx}_${vi}`) ?? v.id,
      })),
    },
  })) as ItemOption[]

  // 6. Set inventory if specified
  for (let i = 0; i < variations.length; i++) {
    const rawVariation = variations[i]
    const realVariationId =
      idMap.get(rawVariation.id ?? `#VAR_${i}`) ?? rawVariation.id
    const inventory = rawVariation.item_variation_data.km_inventory
    if (inventory !== undefined && Number(inventory) > 0 && realVariationId) {
      try {
        await sq.inventory.batchCreateChanges({
          idempotencyKey: randomUUID(),
          changes: [
            {
              type: "PHYSICAL_COUNT",
              physicalCount: {
                catalogObjectId: realVariationId,
                locationId: tokens.location_id,
                state: "IN_STOCK",
                quantity: String(inventory),
                occurredAt: new Date().toISOString(),
              },
            },
          ],
        })
      } catch {
        // Inventory set failure is non-fatal
      }
    }
  }

  // 7. Build and write mirror product
  const resolvedVariations: CatalogItemVariation[] = variations.map((v, i) => ({
    ...v,
    id: idMap.get(v.id ?? `#VAR_${i}`) ?? v.id,
  }))

  const itemData: CatalogItemData = {
    name: input.name,
    description_html: input.description_html,
    is_archived: isDraft,
    available_online: input.available_online ?? true,
    image_urls: input.image_urls,
    categories: (input.category_ids ?? []).map((id) => ({ id })),
    variations: resolvedVariations,
    item_options: resolvedOptions.map((o) => ({ item_option_id: o.id! })),
    modifier_list_info: resolvedModifierListIds.map((id) => ({
      modifier_list_id: id,
    })),
    km_markups: input.km_markups,
    km_discount_amount: 0,
  }

  const mirrorProduct: SquareMirrorProduct = {
    client_id: clientId,
    id: productSK(realItemId, isDraft),
    raw_id: realItemId,
    type: isDraft ? "sqproddraft" : "sqprod",
    slug: toSlug(input.name),
    item_data: itemData,
    options: resolvedOptions.length ? resolvedOptions : undefined,
    km_status: isDraft ? "Draft" : "Published",
  }

  await putMirrorProduct(mirrorProduct)
  return mirrorProduct
}

export async function updateSquareProduct(
  rawId: string,
  input: UpdateProductInput
): Promise<SquareMirrorProduct> {
  const [sq, tokens, clientId] = await Promise.all([
    requireSquareClient(),
    getSquareTokens(),
    getActiveClientId(),
  ])
  if (!tokens) throw new Error("Square not configured")

  const existing = await getMirrorProduct(clientId, rawId)
  if (!existing) throw new Error(`Product ${rawId} not found in mirror`)

  const isDraft = input.status
    ? input.status === "Draft"
    : existing.type === "sqproddraft"
  const wasPublished = existing.type === "sqprod"
  const isNowDraft = isDraft

  // Build variations if options changed
  const options = (input.options ??
    (existing.options as ItemOption[] | undefined) ??
    []) as ItemOption[]
  const basePriceCents =
    input.price ??
    existing.item_data.variations?.[0]?.item_variation_data.price_money
      .amount ??
    0

  const catalogVariations =
    options.length > 0 || input.price !== undefined
      ? computeVariations(options, basePriceCents, rawId)
      : undefined

  // Build update patch
  const updateObject: Record<string, unknown> = {
    type: "ITEM",
    id: rawId,
    itemData: {
      name: input.name ?? existing.item_data.name,
      descriptionHtml:
        input.description_html ?? existing.item_data.description_html,
      isArchived: isDraft,
      availableOnline:
        input.available_online ?? existing.item_data.available_online,
      categoryIds:
        input.category_ids ?? existing.item_data.categories?.map((c) => c.id),
      variations: catalogVariations
        ? catalogVariations.map((v) => ({
            type: "ITEM_VARIATION",
            id: v.id,
            itemVariationData: {
              name: v.item_variation_data.name,
              pricingType: "FIXED_PRICING",
              priceMoney: {
                amount: BigInt(v.item_variation_data.price_money.amount),
                currency: "USD",
              },
              itemOptionValues: (
                v.item_variation_data.item_option_values ?? []
              ).map((ov) => ({
                itemOptionId: ov.item_option_id,
                itemOptionValueId: ov.item_option_value_id,
              })),
            },
          }))
        : undefined,
    },
  }

  await sq.catalog.object.upsert({
    idempotencyKey: randomUUID(),
    object: updateObject as unknown as Parameters<
      typeof sq.catalog.object.upsert
    >[0]["object"],
  })

  // Build updated mirror product
  const updatedItemData: CatalogItemData = {
    ...existing.item_data,
    name: input.name ?? existing.item_data.name,
    description_html:
      input.description_html ?? existing.item_data.description_html,
    is_archived: isDraft,
    available_online:
      input.available_online ?? existing.item_data.available_online,
    image_urls: input.image_urls ?? existing.item_data.image_urls,
    categories: (
      input.category_ids ??
      existing.item_data.categories?.map((c) => c.id) ??
      []
    ).map((id) => ({ id })),
    variations: catalogVariations ?? existing.item_data.variations,
    km_markups: input.km_markups ?? existing.item_data.km_markups,
  }

  const updated: SquareMirrorProduct = {
    ...existing,
    id: productSK(rawId, isNowDraft),
    type: isNowDraft ? "sqproddraft" : "sqprod",
    slug: toSlug(updatedItemData.name),
    item_data: updatedItemData,
    options: (input.options as ItemOption[] | undefined) ?? existing.options,
    km_status: isNowDraft ? "Draft" : "Published",
    updated_at: new Date().toISOString(),
  }

  // Swap prefix if published state changed
  if (wasPublished !== !isNowDraft) {
    await swapProductPrefix(clientId, rawId, updated)
  } else {
    await putMirrorProduct(updated)
  }

  return updated
}

export async function deleteSquareProduct(rawId: string): Promise<void> {
  const [sq, clientId] = await Promise.all([
    requireSquareClient(),
    getActiveClientId(),
  ])
  await sq.catalog.object.delete({ objectId: rawId })
  await deleteMirrorProduct(clientId, rawId)
}

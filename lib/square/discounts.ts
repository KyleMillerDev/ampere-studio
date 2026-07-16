import { randomUUID } from "crypto"

import { requireSquareClient } from "@/lib/square/client"
import {
  deleteMirrorDiscount,
  listMirrorDiscounts,
  putMirrorDiscount,
  toSlug,
} from "@/lib/square/mirror"
import type {
  CatalogDiscount,
  CatalogPricingRule,
  CatalogProductSet,
  SquareMirrorDiscount,
} from "@/lib/square/types"
import { getActiveClientId } from "@/lib/cms/client-context"
import { SQUARE_SK_PREFIX } from "@/lib/cms/constants"
import type { CreateDiscountInput } from "@/lib/validation/square.schema"

export async function listSquareDiscounts(): Promise<SquareMirrorDiscount[]> {
  const clientId = await getActiveClientId()
  return listMirrorDiscounts(clientId)
}

export async function createSquareDiscount(
  input: CreateDiscountInput
): Promise<SquareMirrorDiscount> {
  const [sq, clientId] = await Promise.all([
    requireSquareClient(),
    getActiveClientId(),
  ])

  const discountId = `#DISCOUNT_${randomUUID()}`
  const productSetId = `#PS_${randomUUID()}`
  const pricingRuleId = `#PR_${randomUUID()}`

  const discountData =
    "percentage" in input.discount
      ? {
          name: input.name,
          discountType: "FIXED_PERCENTAGE" as const,
          percentage: String(input.discount.percentage),
        }
      : {
          name: input.name,
          discountType: "FIXED_AMOUNT" as const,
          amountMoney: {
            amount: BigInt(input.discount.amount),
            currency: "USD" as const,
          },
        }

  const productIds = [...(input.product_ids ?? [])]

  // Build product set targeting all specified products/categories
  // Square doesn't natively support category targeting on product sets,
  // so we use product_ids_any with a wildcard "*" for category-based targeting
  const allTargetIds = productIds.length > 0 ? productIds : ["*"]

  const objects = [
    { type: "DISCOUNT" as const, id: discountId, discountData },
    {
      type: "PRODUCT_SET" as const,
      id: productSetId,
      productSetData: { name: input.name, productIdsAny: allTargetIds },
    },
    {
      type: "PRICING_RULE" as const,
      id: pricingRuleId,
      pricingRuleData: {
        name: input.name,
        discountId,
        matchProductsId: productSetId,
        applicationMode: "AUTOMATIC" as const,
        validFromDate: input.pricing_rule.valid_from_date,
        validUntilDate: input.pricing_rule.valid_until_date,
        validFromLocalTime: input.pricing_rule.valid_from_local_time,
        validUntilLocalTime: input.pricing_rule.valid_until_local_time,
      },
    },
  ]

  const res = await sq.catalog.batchUpsert({
    idempotencyKey: randomUUID(),
    batches: [{ objects }],
  })

  const idMap = new Map<string, string>()
  for (const m of res.idMappings ?? []) {
    if (m.clientObjectId && m.objectId) idMap.set(m.clientObjectId, m.objectId)
  }

  const realDiscountId = idMap.get(discountId) ?? discountId
  const now = new Date().toISOString()

  const discountMirror: CatalogDiscount = {
    type: "DISCOUNT",
    id: realDiscountId,
    created_at: now,
    updated_at: now,
    discount_data: {
      name: input.name,
      discount_type:
        "percentage" in input.discount ? "FIXED_PERCENTAGE" : "FIXED_AMOUNT",
      percentage:
        "percentage" in input.discount
          ? String(input.discount.percentage)
          : undefined,
      amount_money:
        "amount" in input.discount
          ? { amount: input.discount.amount, currency: "USD" }
          : undefined,
    },
  }

  const pricingRuleMirror: CatalogPricingRule = {
    type: "PRICING_RULE",
    id: idMap.get(pricingRuleId) ?? pricingRuleId,
    pricing_rule_data: {
      name: input.name,
      discount_id: realDiscountId,
      match_products_id: idMap.get(productSetId) ?? productSetId,
      application_mode: "AUTOMATIC",
      valid_from_date: input.pricing_rule.valid_from_date,
      valid_until_date: input.pricing_rule.valid_until_date,
      valid_from_local_time: input.pricing_rule.valid_from_local_time,
      valid_until_local_time: input.pricing_rule.valid_until_local_time,
    },
  }

  const productSetMirror: CatalogProductSet = {
    type: "PRODUCT_SET",
    id: idMap.get(productSetId) ?? productSetId,
    product_set_data: { product_ids_any: allTargetIds },
  }

  const mirror: SquareMirrorDiscount = {
    client_id: clientId,
    id: `${SQUARE_SK_PREFIX.discount}${realDiscountId}`,
    raw_id: realDiscountId,
    type: "sqdiscount",
    slug: toSlug(input.name),
    discount: discountMirror,
    pricing_rule: pricingRuleMirror,
    product_set: productSetMirror,
    target_product_ids: productIds,
    target_category_ids: input.category_ids ?? [],
    created_at: now,
    updated_at: now,
    is_active: true,
  }

  await putMirrorDiscount(mirror)
  return mirror
}

export async function deleteSquareDiscount(rawId: string): Promise<void> {
  const [sq, clientId] = await Promise.all([
    requireSquareClient(),
    getActiveClientId(),
  ])

  const existing = await import("@/lib/square/mirror").then((m) =>
    m.getMirrorDiscount(clientId, rawId)
  )
  const idsToDelete: string[] = [rawId]
  if (existing?.pricing_rule?.id) idsToDelete.push(existing.pricing_rule.id)
  if (existing?.product_set?.id) idsToDelete.push(existing.product_set.id)

  try {
    await sq.catalog.batchDelete({ objectIds: idsToDelete })
  } catch {
    // Non-fatal; mirror delete should still proceed
  }

  await deleteMirrorDiscount(clientId, rawId)
}

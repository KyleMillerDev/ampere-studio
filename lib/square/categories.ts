import { randomUUID } from "crypto"

import { requireSquareClient } from "@/lib/square/client"
import {
  deleteMirrorCategory,
  getMirrorCategory,
  listMirrorCategories,
  categorySK,
  putMirrorCategory,
  toSlug,
} from "@/lib/square/mirror"
import type { SquareMirrorCategory } from "@/lib/square/types"
import { getActiveClientId } from "@/lib/cms/client-context"
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validation/square.schema"

export async function listSquareCategories(): Promise<SquareMirrorCategory[]> {
  const clientId = await getActiveClientId()
  return listMirrorCategories(clientId)
}

export async function getSquareCategory(
  rawId: string
): Promise<SquareMirrorCategory | null> {
  const clientId = await getActiveClientId()
  return getMirrorCategory(clientId, rawId)
}

export async function createSquareCategory(
  input: CreateCategoryInput
): Promise<SquareMirrorCategory> {
  const [sq, clientId] = await Promise.all([
    requireSquareClient(),
    getActiveClientId(),
  ])
  const isDraft = input.status === "Draft"
  const catId = `#CAT_${randomUUID()}`

  const res = await sq.catalog.object.upsert({
    idempotencyKey: randomUUID(),
    object: {
      type: "CATEGORY",
      id: catId,
      categoryData: {
        name: input.name,
        isTopLevel: true,
        onlineVisibility: !isDraft && input.available_online !== false,
      },
    },
  })

  const realId = res.catalogObject?.id ?? catId

  const mirrorCat: SquareMirrorCategory = {
    client_id: clientId,
    id: categorySK(realId),
    raw_id: realId,
    type: "sqcat",
    slug: toSlug(input.name),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category_data: {
      name: input.name,
      category_type: "REGULAR_CATEGORY",
      description_html: input.description_html,
      online_visibility: !isDraft && input.available_online !== false,
      is_archived: isDraft,
      km_available_from_date: input.available_from_date,
      km_available_until_date: input.available_until_date,
    },
    km_status: input.status,
  }

  await putMirrorCategory(mirrorCat)
  return mirrorCat
}

export async function updateSquareCategory(
  rawId: string,
  input: UpdateCategoryInput
): Promise<SquareMirrorCategory> {
  const [sq, clientId] = await Promise.all([
    requireSquareClient(),
    getActiveClientId(),
  ])
  const existing = await getMirrorCategory(clientId, rawId)
  if (!existing) throw new Error(`Category ${rawId} not found`)

  const isDraft = input.status
    ? input.status === "Draft"
    : existing.km_status === "Draft"

  await sq.catalog.object.upsert({
    idempotencyKey: randomUUID(),
    object: {
      type: "CATEGORY",
      id: rawId,
      categoryData: {
        name: input.name ?? existing.category_data.name,
        onlineVisibility: !isDraft && input.available_online !== false,
      },
    },
  })

  const updated: SquareMirrorCategory = {
    ...existing,
    slug: toSlug(input.name ?? existing.category_data.name),
    updated_at: new Date().toISOString(),
    category_data: {
      ...existing.category_data,
      name: input.name ?? existing.category_data.name,
      description_html:
        input.description_html ?? existing.category_data.description_html,
      online_visibility: !isDraft && input.available_online !== false,
      is_archived: isDraft,
      km_available_from_date:
        input.available_from_date ??
        existing.category_data.km_available_from_date,
      km_available_until_date:
        input.available_until_date ??
        existing.category_data.km_available_until_date,
    },
    km_status: (input.status ?? existing.km_status) as
      | "Featured"
      | "Published"
      | "Draft",
  }

  await putMirrorCategory(updated)
  return updated
}

export async function deleteSquareCategory(rawId: string): Promise<void> {
  const [sq, clientId] = await Promise.all([
    requireSquareClient(),
    getActiveClientId(),
  ])
  await sq.catalog.object.delete({ objectId: rawId })
  await deleteMirrorCategory(clientId, rawId)
}

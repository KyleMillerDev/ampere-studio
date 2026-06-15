import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"

import { getDynamo } from "@/lib/aws/dynamo"
import { CONTENT_TABLE, SK_PREFIX } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import type {
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
} from "@/lib/validation/category.schema"

const SK_PREFIX_CATEGORY = SK_PREFIX.category

function newCategoryId(): string {
  return `${SK_PREFIX_CATEGORY}${uuidv4()}`
}

function toCategory(item: Record<string, unknown>): Category {
  return {
    id: String(item.id),
    client_id: String(item.client_id),
    name: String(item.name ?? ""),
    slug: String(item.slug ?? ""),
    description: String(item.description ?? ""),
    parentCategoryId: item.parentCategoryId
      ? String(item.parentCategoryId)
      : undefined,
    sortOrder: Number(item.sortOrder ?? 0),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  }
}

export async function listCategories(): Promise<Category[]> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_CATEGORY,
      },
    })
  )
  return (res.Items ?? [])
    .map(toCategory)
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.name.localeCompare(b.name)
    )
}

export async function getCategory(id: string): Promise<Category | null> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  return res.Item ? toCategory(res.Item) : null
}

export async function createCategory(
  input: CategoryCreateInput
): Promise<Category> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()
  const item: Category = {
    id: newCategoryId(),
    client_id: clientId,
    createdAt: now,
    updatedAt: now,
    ...input,
  }
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: item,
    })
  )
  return item
}

export async function updateCategory(
  id: string,
  input: CategoryUpdateInput
): Promise<Category | null> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()

  const setParts: string[] = ["updatedAt = :updatedAt"]
  const values: Record<string, unknown> = { ":updatedAt": now }
  const names: Record<string, string> = {}

  for (const [rawKey, value] of Object.entries(input)) {
    if (value === undefined) continue
    const attr = `#${rawKey}`
    const placeholder = `:${rawKey}`
    names[attr] = rawKey
    values[placeholder] = value
    setParts.push(`${attr} = ${placeholder}`)
  }

  const res = await getDynamo().send(
    new UpdateCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  )
  return res.Attributes ? toCategory(res.Attributes) : null
}

export async function deleteCategory(id: string): Promise<void> {
  const clientId = await getActiveClientId()
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
}

export async function countCategories(): Promise<number> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_CATEGORY,
      },
      Select: "COUNT",
    })
  )
  return res.Count ?? 0
}

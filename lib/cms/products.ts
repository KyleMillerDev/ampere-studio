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
  Product,
  ProductCreateInput,
  ProductUpdateInput,
} from "@/lib/validation/product.schema"

const SK_PREFIX_PRODUCT = SK_PREFIX.product

function newProductId(): string {
  return `${SK_PREFIX_PRODUCT}${uuidv4()}`
}

function toProduct(item: Record<string, unknown>): Product {
  return {
    id: String(item.id),
    client_id: String(item.client_id),
    name: String(item.name ?? ""),
    description: String(item.description ?? ""),
    priceCents: Number(item.priceCents ?? 0),
    sku: String(item.sku ?? ""),
    inventory: Number(item.inventory ?? 0),
    categoryId: item.categoryId ? String(item.categoryId) : undefined,
    imageIds: Array.isArray(item.imageIds) ? (item.imageIds as string[]) : [],
    status: (item.status as Product["status"]) ?? "draft",
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  }
}

export async function listProducts(): Promise<Product[]> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_PRODUCT,
      },
    })
  )
  return (res.Items ?? [])
    .map(toProduct)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function getProduct(id: string): Promise<Product | null> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  return res.Item ? toProduct(res.Item) : null
}

export async function createProduct(
  input: ProductCreateInput
): Promise<Product> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()
  const item: Product = {
    id: newProductId(),
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

export async function updateProduct(
  id: string,
  input: ProductUpdateInput
): Promise<Product | null> {
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
  return res.Attributes ? toProduct(res.Attributes) : null
}

export async function deleteProduct(id: string): Promise<void> {
  const clientId = await getActiveClientId()
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
}

export async function countProducts(): Promise<number> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_PRODUCT,
      },
      Select: "COUNT",
    })
  )
  return res.Count ?? 0
}

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { CONTENT_TABLE, SK_PREFIX } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  addressToSlug,
  type RentalCreateInput,
  type RentalRecord,
  type RentalUpdateInput,
} from "@/lib/validation/rental.schema"

const RENTAL_PREFIX = SK_PREFIX.rental

function toRental(item: Record<string, unknown>): RentalRecord {
  const address = (item.address ?? {}) as Record<string, unknown>
  const agent = (item.agent ?? {}) as Record<string, unknown>
  return {
    id: String(item.id),
    client_id: String(item.client_id),
    slug: String(item.slug ?? ""),
    status: (item.status as RentalRecord["status"]) ?? "active",
    mlsId: item.mlsId != null ? String(item.mlsId) : null,
    price: Number(item.price ?? 0),
    address: {
      street: String(address.street ?? ""),
      city: String(address.city ?? ""),
      state: String(address.state ?? ""),
      zip: String(address.zip ?? ""),
    },
    county: String(item.county ?? ""),
    lat: Number(item.lat ?? 0),
    lng: Number(item.lng ?? 0),
    beds: Number(item.beds ?? 0),
    baths: Number(item.baths ?? 0),
    halfBaths: Number(item.halfBaths ?? 0),
    sqft: Number(item.sqft ?? 0),
    lotSizeAcres: Number(item.lotSizeAcres ?? 0),
    yearBuilt: Number(item.yearBuilt ?? 0),
    propertyType: item.propertyType as RentalRecord["propertyType"],
    garageSpaces: Number(item.garageSpaces ?? 0),
    stories: Number(item.stories ?? 1),
    hoaFee: Number(item.hoaFee ?? 0),
    propertyTax: Number(item.propertyTax ?? 0),
    daysOnMarket: Number(item.daysOnMarket ?? 0),
    listedDate: String(item.listedDate ?? ""),
    description: String(item.description ?? ""),
    features: Array.isArray(item.features) ? (item.features as string[]) : [],
    images: Array.isArray(item.images) ? (item.images as string[]) : [],
    agent: {
      name: String(agent.name ?? ""),
      phone: String(agent.phone ?? ""),
      email: String(agent.email ?? ""),
    },
    updatedAt: String(item.updatedAt ?? ""),
  }
}

export async function listRentals(): Promise<RentalRecord[]> {
  const clientId = await getActiveClientId()
  const items: RentalRecord[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new QueryCommand({
        TableName: CONTENT_TABLE,
        KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
        ExpressionAttributeValues: {
          ":cid": clientId,
          ":prefix": RENTAL_PREFIX,
        },
        ExclusiveStartKey: startKey,
      })
    )

    for (const raw of res.Items ?? []) {
      items.push(toRental(raw))
    }

    startKey = res.LastEvaluatedKey
  } while (startKey)

  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function getRental(id: string): Promise<RentalRecord | null> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  return res.Item ? toRental(res.Item) : null
}

/**
 * Build a tenant-unique slug by starting with the candidate and appending
 * -2, -3, ... until the conditional PutItem succeeds or we exhaust retries.
 */
async function putWithUniqueSlug(
  clientId: string,
  baseSlug: string,
  record: Omit<RentalRecord, "id" | "slug">
): Promise<RentalRecord> {
  const MAX_ATTEMPTS = 20
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    const id = `${RENTAL_PREFIX}${slug}`
    const item: RentalRecord = { ...record, id, slug, client_id: clientId }

    try {
      await getDynamo().send(
        new PutCommand({
          TableName: CONTENT_TABLE,
          Item: item,
          ConditionExpression: "attribute_not_exists(id)",
        })
      )
      return item
    } catch (err) {
      const name = (err as { name?: string })?.name
      if (name !== "ConditionalCheckFailedException") throw err
      // slug taken — try next suffix
    }
  }
  throw new Error(
    `Could not create a unique slug after ${MAX_ATTEMPTS} attempts`
  )
}

export async function createRental(
  input: RentalCreateInput
): Promise<RentalRecord> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()

  const baseSlug =
    (input.slug && input.slug.trim()) || addressToSlug(input.address)

  const record: Omit<RentalRecord, "id" | "slug"> = {
    client_id: clientId,
    status: input.status ?? "active",
    mlsId: input.mlsId ?? null,
    price: input.price,
    address: input.address,
    county: input.county,
    lat: input.lat,
    lng: input.lng,
    beds: input.beds,
    baths: input.baths,
    halfBaths: input.halfBaths ?? 0,
    sqft: input.sqft,
    lotSizeAcres: input.lotSizeAcres ?? 0,
    yearBuilt: input.yearBuilt ?? 0,
    propertyType: input.propertyType,
    garageSpaces: input.garageSpaces ?? 0,
    stories: input.stories ?? 1,
    hoaFee: input.hoaFee ?? 0,
    propertyTax: input.propertyTax ?? 0,
    daysOnMarket: input.daysOnMarket ?? 0,
    listedDate: input.listedDate,
    description: input.description,
    features: input.features ?? [],
    images: input.images ?? [],
    agent: input.agent,
    updatedAt: now,
  }

  return putWithUniqueSlug(clientId, baseSlug, record)
}

export async function updateRental(
  id: string,
  input: RentalUpdateInput
): Promise<RentalRecord | null> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()

  const setParts: string[] = ["updatedAt = :updatedAt"]
  const values: Record<string, unknown> = { ":updatedAt": now }
  const names: Record<string, string> = {}

  const scalarFields = [
    "status",
    "mlsId",
    "price",
    "county",
    "lat",
    "lng",
    "beds",
    "baths",
    "halfBaths",
    "sqft",
    "lotSizeAcres",
    "yearBuilt",
    "propertyType",
    "garageSpaces",
    "stories",
    "hoaFee",
    "propertyTax",
    "daysOnMarket",
    "listedDate",
    "description",
    "features",
    "images",
  ] as const

  for (const key of scalarFields) {
    const value = input[key]
    if (value === undefined) continue
    const attr = `#${key}`
    const placeholder = `:${key}`
    names[attr] = key
    values[placeholder] = value
    setParts.push(`${attr} = ${placeholder}`)
  }

  if (input.address !== undefined) {
    names["#address"] = "address"
    values[":address"] = input.address
    setParts.push("#address = :address")
  }

  if (input.agent !== undefined) {
    names["#agent"] = "agent"
    values[":agent"] = input.agent
    setParts.push("#agent = :agent")
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

  return res.Attributes ? toRental(res.Attributes) : null
}

export async function setRentalStatus(
  id: string,
  status: "active" | "rented"
): Promise<RentalRecord | null> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()

  const res = await getDynamo().send(
    new UpdateCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":updatedAt": now },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  )

  return res.Attributes ? toRental(res.Attributes) : null
}

export async function deleteRental(id: string): Promise<void> {
  const clientId = await getActiveClientId()
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
}

export async function countRentals(): Promise<number> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": RENTAL_PREFIX,
      },
      Select: "COUNT",
    })
  )
  return res.Count ?? 0
}

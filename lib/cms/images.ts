import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"

import { getDynamo } from "@/lib/aws/dynamo"
import { deleteObject, publicUrlFor } from "@/lib/aws/s3"
import { CONTENT_TABLE, SK_PREFIX } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"

const SK_PREFIX_IMAGE = SK_PREFIX.image

export interface StudioImage {
  id: string
  client_id: string
  s3Key: string
  s3Url: string
  filename: string
  contentType: string
  sizeBytes: number
  width?: number
  height?: number
  alt: string
  status: "pending" | "ready"
  uploadedAt: string
}

export function newImageId(): string {
  return `${SK_PREFIX_IMAGE}${uuidv4()}`
}

/** Build the deterministic S3 key we will presign for the browser to PUT. */
export function buildImageKey(params: {
  clientId: string
  imageId: string
  filename: string
}): string {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${params.clientId}/images/${params.imageId}/${safeName}`
}

function toImage(item: Record<string, unknown>): StudioImage {
  return {
    id: String(item.id),
    client_id: String(item.client_id),
    s3Key: String(item.s3Key ?? ""),
    s3Url: String(item.s3Url ?? ""),
    filename: String(item.filename ?? ""),
    contentType: String(item.contentType ?? ""),
    sizeBytes: Number(item.sizeBytes ?? 0),
    width: item.width !== undefined ? Number(item.width) : undefined,
    height: item.height !== undefined ? Number(item.height) : undefined,
    alt: String(item.alt ?? ""),
    status: (item.status as StudioImage["status"]) ?? "ready",
    uploadedAt: String(item.uploadedAt),
  }
}

export async function listImages(): Promise<StudioImage[]> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_IMAGE,
      },
    })
  )
  return (res.Items ?? [])
    .map(toImage)
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
}

export async function getImage(id: string): Promise<StudioImage | null> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  return res.Item ? toImage(res.Item) : null
}

/** Pending row written before the client PUTs the file to S3. */
export async function createPendingImage(params: {
  clientId?: string
  imageId: string
  filename: string
  contentType: string
  sizeBytes: number
  alt?: string
}): Promise<StudioImage> {
  const clientId = params.clientId ?? (await getActiveClientId())
  const key = buildImageKey({
    clientId,
    imageId: params.imageId,
    filename: params.filename,
  })
  const item: StudioImage = {
    id: params.imageId,
    client_id: clientId,
    s3Key: key,
    s3Url: publicUrlFor(key),
    filename: params.filename,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
    alt: params.alt ?? "",
    status: "pending",
    uploadedAt: new Date().toISOString(),
  }
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: item,
    })
  )
  return item
}

/** Promote an image row from `pending` to `ready` after the S3 upload completes. */
export async function finalizeImage(
  id: string,
  patch: {
    width?: number
    height?: number
    alt?: string
    sizeBytes?: number
  }
): Promise<StudioImage | null> {
  const clientId = await getActiveClientId()
  const setParts: string[] = ["#status = :ready", "uploadedAt = :uploadedAt"]
  const names: Record<string, string> = { "#status": "status" }
  const values: Record<string, unknown> = {
    ":ready": "ready" as StudioImage["status"],
    ":uploadedAt": new Date().toISOString(),
  }

  if (patch.width !== undefined) {
    setParts.push("width = :width")
    values[":width"] = patch.width
  }
  if (patch.height !== undefined) {
    setParts.push("height = :height")
    values[":height"] = patch.height
  }
  if (patch.alt !== undefined) {
    setParts.push("alt = :alt")
    values[":alt"] = patch.alt
  }
  if (patch.sizeBytes !== undefined) {
    setParts.push("sizeBytes = :sizeBytes")
    values[":sizeBytes"] = patch.sizeBytes
  }

  const res = await getDynamo().send(
    new UpdateCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
      UpdateExpression: `SET ${setParts.join(", ")}`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: names,
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW",
    })
  )
  return res.Attributes ? toImage(res.Attributes) : null
}

export async function deleteImage(id: string): Promise<void> {
  const clientId = await getActiveClientId()
  const existing = await getImage(id)
  if (!existing) return
  try {
    await deleteObject(existing.s3Key)
  } catch {
    // Ignore S3 miss; proceed with DDB cleanup so the gallery is consistent.
  }
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
}

export async function countImages(): Promise<number> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_IMAGE,
      },
      Select: "COUNT",
    })
  )
  return res.Count ?? 0
}

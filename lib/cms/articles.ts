import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"

import { deletePublicObject, getObjectText, putObjectText } from "@/lib/aws/s3"
import { getDynamo } from "@/lib/aws/dynamo"
import { CONTENT_TABLE, SK_PREFIX } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import { isAiArticlePaymentBypassed } from "@/lib/cms/ai-billing"
import type {
  Article,
  ArticleCreateInput,
  ArticleUpdateInput,
  ArticleWithBody,
} from "@/lib/validation/article.schema"

const SK_PREFIX_ARTICLE = SK_PREFIX.article

export class ArticlePaymentRequiredError extends Error {
  readonly article: ArticleWithBody

  constructor(article: ArticleWithBody) {
    super("payment_required")
    this.name = "ArticlePaymentRequiredError"
    this.article = article
  }
}

function newArticleId(): string {
  return `${SK_PREFIX_ARTICLE}${uuidv4()}`
}

export function buildArticleS3Key(clientId: string, slug: string): string {
  return `${clientId}/articles/${slug}.mdx`
}

function toArticle(item: Record<string, unknown>): Article {
  return {
    id: String(item.id),
    client_id: String(item.client_id),
    s3Key: String(item.s3Key ?? ""),
    title: String(item.title ?? ""),
    slug: String(item.slug ?? ""),
    status: (item.status as Article["status"]) ?? "draft",
    thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : undefined,
    excerpt: String(item.excerpt ?? ""),
    publishedAt: item.publishedAt ? String(item.publishedAt) : undefined,
    aiGenerated: Boolean(item.aiGenerated),
    paidAt: item.paidAt ? String(item.paidAt) : undefined,
    aiModel: item.aiModel ? String(item.aiModel) : undefined,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  }
}

export async function listArticles(): Promise<Article[]> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_ARTICLE,
      },
    })
  )
  return (res.Items ?? [])
    .map(toArticle)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function getArticle(id: string): Promise<ArticleWithBody | null> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  if (!res.Item) return null

  const article = toArticle(res.Item)
  let body = ""
  if (article.s3Key) {
    try {
      body = await getObjectText(article.s3Key)
    } catch {
      body = ""
    }
  }
  return { ...article, body }
}

export async function createArticle(
  input: ArticleCreateInput
): Promise<ArticleWithBody> {
  const clientId = await getActiveClientId()
  const now = new Date().toISOString()
  const id = newArticleId()
  const s3Key = buildArticleS3Key(clientId, input.slug)
  const thumbnailUrl = input.thumbnailUrl?.trim() || undefined
  const aiGenerated = input.aiGenerated ?? false
  const paymentRequired =
    aiGenerated && input.status === "published" && !input.paidAt
  const status =
    paymentRequired && !isAiArticlePaymentBypassed() ? "draft" : input.status
  const publishedAt =
    status === "published" ? (input.publishedAt ?? now) : input.publishedAt

  await putObjectText({ key: s3Key, body: input.body })

  const item: Article = {
    id,
    client_id: clientId,
    s3Key,
    title: input.title,
    slug: input.slug,
    status,
    thumbnailUrl,
    excerpt: input.excerpt,
    publishedAt,
    aiGenerated,
    paidAt: input.paidAt,
    aiModel: input.aiModel,
    createdAt: now,
    updatedAt: now,
  }

  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: item,
    })
  )

  const result = { ...item, body: input.body }

  if (paymentRequired && !isAiArticlePaymentBypassed()) {
    throw new ArticlePaymentRequiredError(result)
  }

  return result
}

export async function updateArticle(
  id: string,
  input: ArticleUpdateInput
): Promise<ArticleWithBody | null> {
  const clientId = await getActiveClientId()
  const existing = await getArticle(id)
  if (!existing) return null

  const now = new Date().toISOString()
  let s3Key = existing.s3Key

  const nextAiGenerated = input.aiGenerated ?? existing.aiGenerated
  const nextPaidAt = input.paidAt ?? existing.paidAt
  const wantsPublish = input.status === "published"
  const paymentBlocked =
    wantsPublish &&
    nextAiGenerated &&
    !nextPaidAt &&
    !isAiArticlePaymentBypassed()

  const effectiveStatus = paymentBlocked ? "draft" : input.status

  if (input.slug && input.slug !== existing.slug) {
    const newKey = buildArticleS3Key(clientId, input.slug)
    const body =
      input.body !== undefined
        ? input.body
        : await getObjectText(existing.s3Key).catch(() => "")
    await putObjectText({ key: newKey, body })
    try {
      await deletePublicObject(existing.s3Key)
    } catch {
      // Ignore S3 miss on old key
    }
    s3Key = newKey
  } else if (input.body !== undefined) {
    await putObjectText({ key: s3Key, body: input.body })
  }

  const setParts: string[] = ["updatedAt = :updatedAt", "s3Key = :s3Key"]
  const values: Record<string, unknown> = {
    ":updatedAt": now,
    ":s3Key": s3Key,
  }
  const names: Record<string, string> = {}

  const metadataFields: (keyof ArticleUpdateInput)[] = [
    "title",
    "slug",
    "status",
    "thumbnailUrl",
    "excerpt",
    "publishedAt",
    "aiGenerated",
    "aiModel",
    "paidAt",
  ]

  for (const rawKey of metadataFields) {
    const value =
      rawKey === "status" && effectiveStatus !== undefined
        ? effectiveStatus
        : input[rawKey]
    if (value === undefined) continue
    const attr = `#${rawKey}`
    const placeholder = `:${rawKey}`
    names[attr] = rawKey
    if (rawKey === "thumbnailUrl") {
      values[placeholder] = value === "" ? null : value
    } else {
      values[placeholder] = value
    }
    setParts.push(`${attr} = ${placeholder}`)
  }

  if (
    effectiveStatus === "published" &&
    existing.status !== "published" &&
    input.publishedAt === undefined &&
    !existing.publishedAt
  ) {
    names["#publishedAt"] = "publishedAt"
    values[":publishedAt"] = now
    setParts.push("#publishedAt = :publishedAt")
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

  if (!res.Attributes) return null

  const updated = toArticle(res.Attributes)
  const body =
    input.body !== undefined
      ? input.body
      : await getObjectText(updated.s3Key).catch(() => existing.body)

  const result = { ...updated, body }

  if (paymentBlocked) {
    throw new ArticlePaymentRequiredError(result)
  }

  return result
}

export async function markArticlePaidAndPublish(
  id: string,
  patch?: { aiModel?: string }
): Promise<ArticleWithBody | null> {
  const clientId = await getActiveClientId()
  const existing = await getArticle(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const setParts = [
    "updatedAt = :updatedAt",
    "paidAt = :paidAt",
    "#status = :published",
  ]
  const values: Record<string, unknown> = {
    ":updatedAt": now,
    ":paidAt": now,
    ":published": "published" as Article["status"],
  }
  const names: Record<string, string> = { "#status": "status" }

  if (!existing.publishedAt) {
    names["#publishedAt"] = "publishedAt"
    values[":publishedAt"] = now
    setParts.push("#publishedAt = :publishedAt")
  }

  if (patch?.aiModel) {
    names["#aiModel"] = "aiModel"
    values[":aiModel"] = patch.aiModel
    setParts.push("#aiModel = :aiModel")
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

  if (!res.Attributes) return null

  const updated = toArticle(res.Attributes)
  const body = await getObjectText(updated.s3Key).catch(() => existing.body)
  return { ...updated, body }
}

export async function deleteArticle(id: string): Promise<void> {
  const clientId = await getActiveClientId()
  const existing = await getArticle(id)
  if (!existing) return

  try {
    if (existing.s3Key) await deletePublicObject(existing.s3Key)
  } catch {
    // Ignore S3 miss; proceed with DDB cleanup
  }

  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
}

export async function countArticles(): Promise<number> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: CONTENT_TABLE,
      KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":prefix": SK_PREFIX_ARTICLE,
      },
      Select: "COUNT",
    })
  )
  return res.Count ?? 0
}

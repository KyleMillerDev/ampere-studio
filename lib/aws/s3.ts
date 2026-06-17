import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { AWS_REGION, IMAGES_BUCKET, PUBLIC_BUCKET } from "@/lib/cms/constants"

let client: S3Client | null = null

export function getS3(): S3Client {
  if (!client) client = new S3Client({ region: AWS_REGION })
  return client
}

export function publicUrlFor(key: string): string {
  return `https://${IMAGES_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURI(key)}`
}

export async function putObjectBuffer(params: {
  key: string
  body: Buffer | Uint8Array
  contentType: string
}): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: IMAGES_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )
}

export async function presignedPutUrl(params: {
  key: string
  contentType: string
  expiresSeconds?: number
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: IMAGES_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  })
  return getSignedUrl(getS3(), cmd, { expiresIn: params.expiresSeconds ?? 900 })
}

export async function presignedGetUrl(params: {
  key: string
  expiresSeconds?: number
}): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: IMAGES_BUCKET, Key: params.key })
  return getSignedUrl(getS3(), cmd, {
    expiresIn: params.expiresSeconds ?? 3600,
  })
}

export async function deleteObject(key: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({ Bucket: IMAGES_BUCKET, Key: key })
  )
}

export function publicBucketUrlFor(key: string): string {
  return `https://${PUBLIC_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURI(key)}`
}

export async function listArticleKeys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const res = await getS3().send(
      new ListObjectsV2Command({
        Bucket: PUBLIC_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key?.endsWith(".mdx")) keys.push(obj.Key)
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

export async function getObjectText(key: string): Promise<string> {
  const res = await getS3().send(
    new GetObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key })
  )
  return (await res.Body?.transformToString()) ?? ""
}

export async function putObjectText(params: {
  key: string
  body: string
}): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: "text/markdown",
    })
  )
}

export async function deletePublicObject(key: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key })
  )
}

import { NextResponse } from "next/server"
import { z } from "zod"

import { presignedPutUrl } from "@/lib/aws/s3"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  buildImageKey,
  createPendingImage,
  listImages,
  newImageId,
} from "@/lib/cms/images"

export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024

const createImageSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .regex(
      /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i,
      "Must be an image MIME type"
    ),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
  alt: z.string().max(500).optional(),
})

export async function GET() {
  const images = await listImages()
  return NextResponse.json({ images })
}

/** Reserve an image row + return a presigned PUT URL the browser uploads to. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = createImageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const imageId = newImageId()
  const clientId = await getActiveClientId()
  const key = buildImageKey({
    clientId,
    imageId,
    filename: parsed.data.filename,
  })

  const [image, uploadUrl] = await Promise.all([
    createPendingImage({
      clientId,
      imageId,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      alt: parsed.data.alt,
    }),
    presignedPutUrl({ key, contentType: parsed.data.contentType }),
  ])

  return NextResponse.json({
    image,
    uploadUrl,
    key,
  })
}

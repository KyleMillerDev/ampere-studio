import { putObjectBuffer } from "@/lib/aws/s3"
import {
  buildImageKey,
  createPendingImage,
  finalizeImage,
  newImageId,
  type StudioImage,
} from "@/lib/cms/images"
import { getActiveClientId } from "@/lib/cms/client-context"

function extensionForContentType(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    case "image/avif":
      return "avif"
    default:
      return "png"
  }
}

function parseDataUrl(dataUrl: string): {
  buffer: Buffer
  contentType: string
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i)
  if (!match) {
    throw new Error("Generated image used an unsupported data format")
  }
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  }
}

async function loadImageBytes(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string }> {
  if (imageUrl.startsWith("data:")) {
    return parseDataUrl(imageUrl)
  }

  const res = await fetch(imageUrl)
  if (!res.ok) {
    throw new Error(`Could not download generated image (${res.status})`)
  }
  const contentType = res.headers.get("content-type") || "image/png"
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}

/** Persist generated image bytes in the media library. */
export async function saveGeneratedImage(params: {
  imageUrl: string
  alt?: string
  filenamePrefix?: string
}): Promise<StudioImage> {
  const { buffer, contentType } = await loadImageBytes(params.imageUrl)
  if (!buffer.length) {
    throw new Error("Generated image was empty")
  }

  const imageId = newImageId()
  const clientId = await getActiveClientId()
  const ext = extensionForContentType(contentType)
  const filename = `${params.filenamePrefix ?? "ai-generated"}-${Date.now()}.${ext}`
  const key = buildImageKey({ clientId, imageId, filename })

  const dimensions = { width: 1024, height: 1024 }
  const width = dimensions.width
  const height = dimensions.height

  const image = await createPendingImage({
    clientId,
    imageId,
    filename,
    contentType,
    sizeBytes: buffer.length,
    alt: params.alt,
  })

  await putObjectBuffer({ key, body: buffer, contentType })

  const finalized = await finalizeImage(image.id, {
    width,
    height,
    alt: params.alt,
    sizeBytes: buffer.length,
  })
  if (!finalized) {
    throw new Error("Could not finalize generated image")
  }
  return finalized
}

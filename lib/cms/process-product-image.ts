export interface ProcessImageOptions {
  /** Longest edge in pixels. Defaults to 512. */
  maxSize?: number
  /** JPEG quality from 0 to 1. Defaults to 0.92. */
  quality?: number
}

/** Resize and re-encode an image as JPEG before upload. */
export async function processImageForUpload(
  file: File,
  options: ProcessImageOptions = {}
): Promise<File> {
  const maxSize = options.maxSize ?? 512
  const quality = options.quality ?? 0.92

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(
      "Could not read this image. Try saving it as JPEG or PNG and upload again."
    )
  }

  const aspect = bitmap.width / bitmap.height

  let width = bitmap.width
  let height = bitmap.height

  if (width > maxSize || height > maxSize) {
    if (width >= height) {
      width = maxSize
      height = Math.ceil(maxSize / aspect)
    } else {
      height = maxSize
      width = Math.ceil(maxSize * aspect)
    }
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    throw new Error("Could not process image")
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Could not process image")),
      "image/jpeg",
      quality
    )
  })

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image"
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80)

  return new File([blob], `${safeName}.jpg`, {
    type: "image/jpeg",
  })
}

/** Resize small product photos to max 512px (matches KMCMS product upload behavior). */
export async function processProductImage(file: File): Promise<File> {
  return processImageForUpload(file, { maxSize: 512, quality: 0.92 })
}

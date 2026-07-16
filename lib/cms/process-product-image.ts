const MAX_IMAGE_SIZE = 512

/** Resize large product photos to max 512px (matches KMCMS product upload behavior). */
export async function processProductImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const aspect = bitmap.width / bitmap.height

  let width = bitmap.width
  let height = bitmap.height

  if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
    if (width >= height) {
      width = MAX_IMAGE_SIZE
      height = Math.ceil(MAX_IMAGE_SIZE / aspect)
    } else {
      height = MAX_IMAGE_SIZE
      width = Math.ceil(MAX_IMAGE_SIZE * aspect)
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
      0.92
    )
  })

  return new File([blob], `processed_image_${crypto.randomUUID()}.jpeg`, {
    type: "image/jpeg",
  })
}

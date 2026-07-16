import type { StudioImage } from "@/lib/cms/images"

async function loadImageDimensions(
  file: File
): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({})
    }
    img.src = url
  })
}

export async function uploadPendingImageFile(
  imageId: string,
  file: File
): Promise<void> {
  return uploadViaApi(imageId, file)
}

async function uploadViaApi(imageId: string, file: File): Promise<void> {
  const res = await fetch(`/api/images/${imageId}/upload`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Upload failed with ${res.status}`)
  }
}

/** Upload a file to the media library via server proxy + finalize. */
export async function uploadStudioImage(
  file: File,
  alt?: string
): Promise<StudioImage> {
  const dims = await loadImageDimensions(file)

  const presignRes = await fetch("/api/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      alt: alt || undefined,
    }),
  })
  if (!presignRes.ok) {
    const err = (await presignRes.json().catch(() => ({}))) as {
      error?: string
    }
    throw new Error(err.error ?? `Presign failed with ${presignRes.status}`)
  }

  const { image } = (await presignRes.json()) as {
    image: StudioImage
  }

  await uploadViaApi(image.id, file)

  const finalizeRes = await fetch(`/api/images/${image.id}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      width: dims.width,
      height: dims.height,
      alt: alt || undefined,
      sizeBytes: file.size,
    }),
  })
  if (!finalizeRes.ok) {
    const err = (await finalizeRes.json().catch(() => ({}))) as {
      error?: string
    }
    throw new Error(err.error ?? `Finalize failed with ${finalizeRes.status}`)
  }

  const { image: finalized } = (await finalizeRes.json()) as {
    image: StudioImage
  }
  return finalized
}

export function markdownImageSnippet(url: string, alt = "Image"): string {
  return `![${alt}](${url})\n\n`
}

export function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  currentValue: string,
  insert: string
): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const next = currentValue.slice(0, start) + insert + currentValue.slice(end)
  const cursor = start + insert.length
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(cursor, cursor)
  })
  return next
}

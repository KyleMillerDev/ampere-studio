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

async function uploadWithProgress(url: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed with ${xhr.status}`))
    })
    xhr.addEventListener("error", () => reject(new Error("Upload failed")))
    xhr.send(file)
  })
}

/** Upload a file to the media library via presigned S3 PUT + finalize. */
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

  const { image, uploadUrl } = (await presignRes.json()) as {
    image: StudioImage
    uploadUrl: string
  }

  await uploadWithProgress(uploadUrl, file)

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

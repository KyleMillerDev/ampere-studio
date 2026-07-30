const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
}

/** Prefer the browser MIME type, then fall back to the file extension. */
export function inferImageContentType(file: File): string {
  const browserType = file.type?.trim().toLowerCase()
  if (browserType.startsWith("image/")) return browserType

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension]
  }

  return "image/jpeg"
}

export function formatImageUploadError(
  payload: unknown,
  fallback: string
): string {
  if (!payload || typeof payload !== "object") return fallback

  const record = payload as {
    error?: string
    issues?: { errors?: string[] } | string
  }

  if (record.error && record.error !== "Validation failed") {
    return record.error
  }

  const issues = record.issues
  if (Array.isArray(issues) && issues.length > 0) {
    return issues.join("; ")
  }

  if (issues && typeof issues === "object" && "errors" in issues) {
    const errors = issues.errors
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.join("; ")
    }
  }

  return record.error ?? fallback
}

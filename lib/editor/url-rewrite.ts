/**
 * URL rewriting helpers for the live-preview proxy.
 *
 * Strategy: every asset the browser needs for the live site gets routed
 * through `/api/editor/live-preview/asset?s=<sessionId>&u=<absoluteUrl>`.
 * That keeps the iframe fully same-origin, which is required so the
 * client site's JS (Next.js router, history.replaceState, etc.) and the
 * editor's postMessage bridge both work without cross-origin errors.
 */

export function shouldSkipUrl(raw: string): boolean {
  if (!raw) return true
  const trimmed = raw.trim()
  if (!trimmed) return true
  if (trimmed.startsWith("data:")) return true
  if (trimmed.startsWith("blob:")) return true
  if (trimmed.startsWith("javascript:")) return true
  if (trimmed.startsWith("mailto:")) return true
  if (trimmed.startsWith("tel:")) return true
  if (trimmed.startsWith("#")) return true
  if (trimmed.startsWith("about:")) return true
  return false
}

export function resolveAgainst(raw: string, base: string): string | null {
  const trimmed = raw.trim()
  try {
    return new URL(trimmed, base).toString()
  } catch {
    return null
  }
}

export function proxyUrlFor(absolute: string, sessionId: string): string {
  return `/api/editor/live-preview/asset?s=${encodeURIComponent(
    sessionId
  )}&u=${encodeURIComponent(absolute)}`
}

/**
 * Attribute values in HTML source can contain entities like `&amp;` which the
 * browser would normally decode before treating them as URL components. Our
 * regex reads the raw source, so we need to decode before URL-resolving and
 * re-encode before inserting back into HTML.
 */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
}

export function encodeForHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

/**
 * Rewrite `url(...)` references inside a CSS string. Relative URLs resolve
 * against `baseHref`, which is the URL the CSS was fetched from (so fonts,
 * images, and other files referenced inside the CSS point at the correct
 * absolute location before we wrap them in the proxy URL).
 */
export function rewriteCssUrls(
  css: string,
  baseHref: string,
  sessionId: string
): string {
  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (match, quote: string, rawUrl: string) => {
      if (shouldSkipUrl(rawUrl)) return match
      const resolved = resolveAgainst(rawUrl, baseHref)
      if (!resolved) return match
      const q = quote || '"'
      return `url(${q}${proxyUrlFor(resolved, sessionId)}${q})`
    }
  )
}

/**
 * Rewrite an HTML string so every asset request flows through our proxy.
 * Covers the attribute/element combinations that typically drive page
 * rendering. Anchor tags are intentionally left alone.
 */
export function rewriteHtml(
  html: string,
  siteUrl: string,
  sessionId: string
): string {
  const proxyFromHtml = (rawAttributeValue: string) => {
    const decoded = decodeHtmlEntities(rawAttributeValue)
    if (shouldSkipUrl(decoded)) return rawAttributeValue
    const resolved = resolveAgainst(decoded, siteUrl)
    if (!resolved) return rawAttributeValue
    return encodeForHtmlAttribute(proxyUrlFor(resolved, sessionId))
  }

  let next = html

  // 1. Strip upstream CSP meta tags so our injected script can run.
  next = next.replace(
    /<meta\b[^>]*http-equiv\s*=\s*(['"])\s*content-security-policy(?:-report-only)?\s*\1[^>]*>/gi,
    ""
  )
  // 2. Drop any existing <base> tag; we serve from our own origin.
  next = next.replace(/<base\b[^>]*>/gi, "")

  // 3. Rewrite href/src/poster on elements that load subresources.
  next = next.replace(
    /(<(?:link|script|img|source|video|audio|iframe|embed)\b[^>]*?\s(?:href|src|poster)\s*=\s*)(["'])([^"']+)\2/gi,
    (_match, prefix: string, quote: string, value: string) =>
      `${prefix}${quote}${proxyFromHtml(value)}${quote}`
  )

  // 4. Rewrite srcset (comma-separated list of URL + descriptor pairs).
  next = next.replace(
    /(<(?:img|source)\b[^>]*?\ssrcset\s*=\s*)(["'])([^"']+)\2/gi,
    (_match, prefix: string, quote: string, value: string) => {
      const rewritten = value
        .split(",")
        .map((part) => {
          const trimmed = part.trim()
          if (!trimmed) return part
          const [rawUrl, ...descriptor] = trimmed.split(/\s+/)
          if (!rawUrl) return part
          const proxied = proxyFromHtml(rawUrl)
          return [proxied, ...descriptor].join(" ")
        })
        .join(", ")
      return `${prefix}${quote}${rewritten}${quote}`
    }
  )

  // 5. Rewrite url(...) inside inline <style>...</style>.
  next = next.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, body: string, close: string) =>
      `${open}${rewriteCssUrls(body, siteUrl, sessionId)}${close}`
  )

  // 6. Rewrite url(...) inside style="..." attributes.
  next = next.replace(
    /(\sstyle\s*=\s*)(["'])([^"']+)\2/gi,
    (_match, prefix: string, quote: string, value: string) =>
      `${prefix}${quote}${rewriteCssUrls(value, siteUrl, sessionId)}${quote}`
  )

  return next
}

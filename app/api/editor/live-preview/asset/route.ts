import { NextResponse } from "next/server"

import { rewriteCssUrls } from "@/lib/editor/url-rewrite"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * Proxy any absolute URL requested by the live-preview iframe.
 *
 * The target URL is validated to http/https only before proxying, which
 * prevents misuse as an open proxy for arbitrary schemes. CSS responses
 * are rewritten in flight so nested `url(...)` references (fonts,
 * background images) also flow through us.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get("s")
  const target = url.searchParams.get("u")

  if (!sessionId || !target) {
    return NextResponse.json(
      { error: "Missing s or u parameter." },
      { status: 400 }
    )
  }

  let upstreamUrl: URL
  try {
    upstreamUrl = new URL(target)
  } catch {
    return NextResponse.json(
      { error: "Target URL is not a valid absolute URL." },
      { status: 400 }
    )
  }

  if (upstreamUrl.protocol !== "https:" && upstreamUrl.protocol !== "http:") {
    return NextResponse.json(
      { error: "Only http and https URLs may be proxied." },
      { status: 400 }
    )
  }

  const upstream = await fetch(upstreamUrl.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": "Ampere-Studio-Live-Preview",
      Accept: req.headers.get("accept") ?? "*/*",
    },
  })

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream"
  const cacheControl =
    upstream.headers.get("cache-control") ?? "public, max-age=300"

  // Cross-origin fonts and other subresources need permissive CORS headers;
  // the iframe loads them same-origin through us, but some browsers still
  // enforce CORS on <font-face>/`crossorigin` requests.
  const baseHeaders: Record<string, string> = {
    "content-type": contentType,
    "cache-control": cacheControl,
    "access-control-allow-origin": "*",
    "cross-origin-resource-policy": "cross-origin",
  }

  if (contentType.includes("text/css")) {
    const css = await upstream.text()
    const rewritten = rewriteCssUrls(css, upstream.url, sessionId)
    return new NextResponse(rewritten, {
      status: upstream.status,
      headers: baseHeaders,
    })
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: baseHeaders,
  })
}

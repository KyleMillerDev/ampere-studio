import { NextResponse } from "next/server"

import { getSquareTokens } from "@/lib/square/config"
import { requireSquareClient } from "@/lib/square/client"
import { incrementalRefresh } from "@/lib/square/sync"
import { getActiveClientId } from "@/lib/cms/client-context"

export const dynamic = "force-dynamic"

/**
 * POST /api/square/webhook
 * Receives Square catalog.version.updated webhooks and triggers an
 * incremental mirror refresh. Signature verification is strongly recommended
 * in production. Set SQUARE_WEBHOOK_SIGNATURE_KEY in env.
 */
export async function POST(req: Request) {
  const rawBody = await req.text()

  // Optional signature verification
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  if (signatureKey) {
    const squareSignature = req.headers.get("x-square-hmacsha256-signature")
    if (!squareSignature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }
    const { createHmac } = await import("crypto")
    const url = req.url
    const expected = createHmac("sha256", signatureKey)
      .update(url + rawBody)
      .digest("base64")
    if (expected !== squareSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let event: { type?: string } = {}
  try {
    event = JSON.parse(rawBody) as { type?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Only process catalog and inventory events
  if (
    event.type === "catalog.version.updated" ||
    event.type === "inventory.count.updated"
  ) {
    // Fire-and-forget in background — don't block the webhook response
    setImmediate(async () => {
      try {
        const [sq, tokens, clientId] = await Promise.all([
          requireSquareClient(),
          getSquareTokens(),
          getActiveClientId(),
        ])
        if (sq && tokens) {
          await incrementalRefresh(sq, clientId, tokens.location_id)
        }
      } catch (err) {
        console.error("[square-webhook] Refresh failed:", err)
      }
    })
  }

  return NextResponse.json({ ok: true })
}

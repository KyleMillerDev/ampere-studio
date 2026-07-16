import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { requireSquareClient } from "@/lib/square/client"
import { getSquareTokens } from "@/lib/square/config"
import { incrementalRefresh } from "@/lib/square/sync"
import { getActiveClientId } from "@/lib/cms/client-context"

export const dynamic = "force-dynamic"

/** POST /api/square/refresh — run incremental mirror sync since last watermark. */
export async function POST() {
  try {
    const [sq, tokens, clientId] = await Promise.all([
      requireSquareClient(),
      getSquareTokens(),
      getActiveClientId(),
    ])
    if (!tokens) {
      return NextResponse.json(
        { error: "Square not configured for this client" },
        { status: 503 }
      )
    }

    const result = await incrementalRefresh(sq, clientId, tokens.location_id)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

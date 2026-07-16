import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { getSquareTokens } from "@/lib/square/config"
import { getActiveClientId } from "@/lib/cms/client-context"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [tokens, clientId] = await Promise.all([
      getSquareTokens(),
      getActiveClientId(),
    ])
    if (!tokens) {
      return NextResponse.json({ connected: false, client_id: clientId })
    }
    return NextResponse.json({
      connected: true,
      client_id: clientId,
      location_id: tokens.location_id,
      environment: tokens.environment,
      redirect_url: tokens.redirect_url,
    })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

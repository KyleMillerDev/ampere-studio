import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import { putSquareSecret } from "@/lib/aws/secrets"
import { getActiveClientId } from "@/lib/cms/client-context"
import type { SquareOAuthTokens } from "@/lib/square/types"

export const dynamic = "force-dynamic"

const connectSchema = z.object({
  access_token: z.string().min(10, "Access token is required"),
  refresh_token: z.string().min(10, "Refresh token is required"),
  environment: z.enum(["production", "sandbox"]),
  redirect_url: z.string().url("Invalid redirect URL"),
  location_id: z.string().min(1, "Location ID is required"),
  client_id: z.string().min(1, "Square client ID is required"),
  client_secret: z.string().min(1, "Square client secret is required"),
})

/** POST /api/square/oauth/connect — store Square OAuth tokens for this client. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = connectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const clientId = await getActiveClientId()
    const tokens: SquareOAuthTokens = {
      access_token: parsed.data.access_token,
      refresh_token: parsed.data.refresh_token,
      environment: parsed.data.environment,
      redirect_url: parsed.data.redirect_url,
      location_id: parsed.data.location_id,
      client_id: parsed.data.client_id,
      client_secret: parsed.data.client_secret,
    }
    await putSquareSecret(clientId, tokens)
    return NextResponse.json({ ok: true, client_id: clientId })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

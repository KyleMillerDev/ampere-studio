import { SquareClient, SquareEnvironment } from "square"

import { getSquareTokens } from "@/lib/square/config"
import type { SquareOAuthTokens } from "@/lib/square/types"

/**
 * Build a configured Square SDK client from a tokens object.
 * The SDK client is intentionally not cached globally since access tokens
 * may be refreshed between requests.
 */
export function buildSquareClient(tokens: SquareOAuthTokens): SquareClient {
  return new SquareClient({
    token: tokens.access_token,
    environment:
      tokens.environment === "sandbox"
        ? SquareEnvironment.Sandbox
        : SquareEnvironment.Production,
  })
}

/**
 * Returns a Square SDK client scoped to the active client's tokens.
 * Throws if no Square tokens are configured for this client.
 */
export async function requireSquareClient(): Promise<SquareClient> {
  const tokens = await getSquareTokens()
  if (!tokens) {
    throw new Error(
      "Square is not configured for this client. Add tokens to Secrets Manager at {client_id}/square."
    )
  }
  return buildSquareClient(tokens)
}

/**
 * Returns a Square SDK client, or null when tokens are absent.
 * Suitable for feature-gated paths where absence is not an error.
 */
export async function getSquareClient(): Promise<SquareClient | null> {
  const tokens = await getSquareTokens()
  if (!tokens) return null
  return buildSquareClient(tokens)
}

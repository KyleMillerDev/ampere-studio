import { getSquareSecret } from "@/lib/aws/secrets"
import { getActiveClientId } from "@/lib/cms/client-context"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import type { SquareOAuthTokens } from "@/lib/square/types"

export type { SquareOAuthTokens }

/**
 * Returns the active client's Square OAuth tokens, or null when the secret
 * is absent. Reading from Secrets Manager is delegated to getSquareSecret,
 * which memoizes the result for 5 minutes.
 */
export async function getSquareTokens(): Promise<SquareOAuthTokens | null> {
  const clientId = await getActiveClientId()
  return getSquareSecret(clientId)
}

/**
 * True when the active client's catalog provider is "square" AND valid
 * Square tokens exist in Secrets Manager.
 */
export async function isSquareEnabled(): Promise<boolean> {
  const [catalog, tokens] = await Promise.all([
    getActiveCatalogProvider(),
    getSquareTokens(),
  ])
  return catalog === "square" && tokens !== null
}

/**
 * True when isSquareEnabled AND the tokens include a location_id, which is
 * required for reading orders.
 */
export async function isSquareOrdersEnabled(): Promise<boolean> {
  const [catalog, tokens] = await Promise.all([
    getActiveCatalogProvider(),
    getSquareTokens(),
  ])
  return catalog === "square" && tokens !== null && Boolean(tokens.location_id)
}

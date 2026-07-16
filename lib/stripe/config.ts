import Stripe from "stripe"

import { getClientKeysSecret } from "@/lib/aws/secrets"
import { getActiveClientId } from "@/lib/cms/client-context"
import { getActiveCatalogProvider } from "@/lib/cms/clients"

export interface StripeKeys {
  publishableKey: string
  secretKey: string
}

/**
 * Look up the active client's Stripe keys from the shared Secrets Manager
 * secret. Both `{client_id}_stripe_publishable` and `{client_id}_stripe_secret`
 * must be present, otherwise the Stripe product builder stays hidden.
 */
export async function getStripeKeys(): Promise<StripeKeys | null> {
  const [secret, clientId] = await Promise.all([
    getClientKeysSecret(),
    getActiveClientId(),
  ])
  const publishableKey = secret[`${clientId}_stripe_publishable`]?.trim()
  const secretKey = secret[`${clientId}_stripe_secret`]?.trim()
  if (!publishableKey || !secretKey) return null
  return { publishableKey, secretKey }
}

let cachedClient: Stripe | null = null
let cachedClientKey: string | null = null

/** Configured Stripe SDK instance for the active client, or null when keys are absent. */
export async function getStripeClient(): Promise<Stripe | null> {
  const keys = await getStripeKeys()
  if (!keys) return null
  if (!cachedClient || cachedClientKey !== keys.secretKey) {
    cachedClient = new Stripe(keys.secretKey)
    cachedClientKey = keys.secretKey
  }
  return cachedClient
}

/**
 * Returns true when the active client has catalog="stripe" AND valid Stripe
 * keys in Secrets Manager. Used to gate the Orders tab/pages, mirroring the
 * same check on the Products pages.
 */
export async function isStripeOrdersEnabled(): Promise<boolean> {
  const [catalog, keys] = await Promise.all([
    getActiveCatalogProvider(),
    getStripeKeys(),
  ])
  return catalog === "stripe" && keys !== null
}

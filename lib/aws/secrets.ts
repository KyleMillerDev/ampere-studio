import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceExistsException,
} from "@aws-sdk/client-secrets-manager"

import { AWS_REGION } from "@/lib/cms/constants"
import type { SquareOAuthTokens } from "@/lib/square/types"

/** Cached singleton so serverless runtimes do not rebuild the client on every request. */
let client: SecretsManagerClient | null = null

export function getSecretsManager(): SecretsManagerClient {
  if (!client) client = new SecretsManagerClient({ region: AWS_REGION })
  return client
}

const CLIENT_KEYS_SECRET_ID = "ampere/clients/keys"

/** Cache window keeps page renders from hammering Secrets Manager. */
const SECRET_CACHE_TTL_MS = 5 * 60 * 1000

let cachedSecret: Record<string, string> | null = null
let cachedAt = 0

/**
 * Fetch and JSON-parse the shared `ampere/clients/keys` secret. Results are
 * memoized for a few minutes. Returns an empty object when the secret is
 * missing or unreadable so callers can treat "no keys" as a soft state.
 */
export async function getClientKeysSecret(): Promise<Record<string, string>> {
  const now = Date.now()
  if (cachedSecret && now - cachedAt < SECRET_CACHE_TTL_MS) {
    return cachedSecret
  }
  try {
    const res = await getSecretsManager().send(
      new GetSecretValueCommand({ SecretId: CLIENT_KEYS_SECRET_ID })
    )
    const raw = res.SecretString ?? "{}"
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") values[key] = value
    }
    cachedSecret = values
    cachedAt = now
    return values
  } catch {
    // Keep serving a stale copy if we have one; otherwise report no keys.
    if (cachedSecret) return cachedSecret
    return {}
  }
}

// ─── Per-client Square secret cache ──────────────────────────────────────────

const squareSecretCache = new Map<
  string,
  { data: SquareOAuthTokens; at: number }
>()

/**
 * Fetch the Square OAuth tokens for a given client from Secrets Manager.
 * Secret path: `{client_id}/square`.
 * Returns null when the secret does not exist or cannot be read.
 */
export async function getSquareSecret(
  clientId: string
): Promise<SquareOAuthTokens | null> {
  const now = Date.now()
  const cached = squareSecretCache.get(clientId)
  if (cached && now - cached.at < SECRET_CACHE_TTL_MS) return cached.data

  try {
    const res = await getSecretsManager().send(
      new GetSecretValueCommand({ SecretId: `${clientId}/square` })
    )
    const raw = res.SecretString
    if (!raw) return null
    const data = JSON.parse(raw) as SquareOAuthTokens
    squareSecretCache.set(clientId, { data, at: now })
    return data
  } catch {
    return null
  }
}

/** Store or update Square OAuth tokens for a client. */
export async function putSquareSecret(
  clientId: string,
  tokens: SquareOAuthTokens
): Promise<void> {
  const secretId = `${clientId}/square`
  const sm = getSecretsManager()
  const secretString = JSON.stringify(tokens)

  try {
    await sm.send(
      new CreateSecretCommand({ Name: secretId, SecretString: secretString })
    )
  } catch (err) {
    if (err instanceof ResourceExistsException) {
      await sm.send(
        new PutSecretValueCommand({
          SecretId: secretId,
          SecretString: secretString,
        })
      )
    } else {
      throw err
    }
  }
  // Bust the cache
  squareSecretCache.delete(clientId)
}

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager"

import { AWS_REGION } from "@/lib/cms/constants"

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

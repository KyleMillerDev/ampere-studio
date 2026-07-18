/**
 * Short in-memory cache for PostHog query responses.
 * Caps API use alongside PostHog's own `refresh` caching.
 */

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** Default server cache window for dashboard / filter-option queries. */
export const POSTHOG_SERVER_CACHE_TTL_MS = 45_000

/** Live traffic should stay fresher. */
export const POSTHOG_LIVE_CACHE_TTL_MS = 15_000

const MAX_ENTRIES = 200

export function getCached<T>(key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return undefined
  }
  return hit.value as T
}

export function setCached<T>(
  key: string,
  value: T,
  ttlMs = POSTHOG_SERVER_CACHE_TTL_MS
): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function cacheKey(parts: unknown[]): string {
  return JSON.stringify(parts)
}

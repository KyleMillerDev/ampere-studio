/**
 * Low-level PostHog Query API client (server-only).
 * Never log or return the personal API key.
 */

import type { PostHogCredentials } from "@/lib/posthog/config"
import type { AnalyticsErrorCode } from "@/lib/analytics/types"

export type PostHogRefreshMode =
  | "blocking"
  | "async"
  | "force_blocking"
  | "force_async"
  | "force_cache"
  | "lazy_async"
  | "async_except_on_cache_miss"

export interface HogQLQueryRequest {
  query: string
  values?: Record<string, unknown>
  name: string
  refresh?: PostHogRefreshMode
  signal?: AbortSignal
}

export interface HogQLQuerySuccess {
  ok: true
  results: unknown[]
  columns?: string[]
  isCached?: boolean
}

export interface HogQLQueryFailure {
  ok: false
  code: AnalyticsErrorCode
  message: string
  httpStatus?: number
  detail?: string
}

export type HogQLQueryResult = HogQLQuerySuccess | HogQLQueryFailure

function mapHttpFailure(
  httpStatus: number,
  bodyText: string
): HogQLQueryFailure {
  let detail = bodyText.slice(0, 500)
  try {
    const parsed = JSON.parse(bodyText) as {
      detail?: string
      type?: string
      code?: string
    }
    if (typeof parsed.detail === "string") detail = parsed.detail
    else if (typeof parsed.code === "string") detail = parsed.code
  } catch {
    // keep truncated body
  }

  // Never echo credential-looking substrings
  detail = detail.replace(/phx_[A-Za-z0-9]+/g, "[redacted]")

  if (httpStatus === 401) {
    return {
      ok: false,
      code: "invalid_credentials",
      message: "PostHog rejected the personal API key.",
      httpStatus,
      detail,
    }
  }
  if (httpStatus === 403) {
    const lower = detail.toLowerCase()
    const scopeBlocked =
      lower.includes("scope") ||
      lower.includes("query:read") ||
      lower.includes("permission")
    return {
      ok: false,
      code: scopeBlocked ? "insufficient_scope" : "invalid_credentials",
      message: scopeBlocked
        ? "PostHog personal API key is missing the query:read scope."
        : "PostHog denied access to this project.",
      httpStatus,
      detail,
    }
  }
  if (httpStatus === 429) {
    return {
      ok: false,
      code: "rate_limited",
      message: "PostHog rate-limited this query.",
      httpStatus,
      detail,
    }
  }
  return {
    ok: false,
    code: "query_failed",
    message: `PostHog query failed with HTTP ${httpStatus}.`,
    httpStatus,
    detail,
  }
}

/**
 * Execute a HogQL query against the configured project.
 * Uses PostHog `values` bindings; never interpolate user input into SQL text
 * except through allowlisted builder modules.
 */
export async function runHogQL(
  credentials: PostHogCredentials,
  request: HogQLQueryRequest
): Promise<HogQLQueryResult> {
  const url = `${credentials.host}/api/projects/${credentials.projectId}/query/`

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: request.query,
          ...(request.values && Object.keys(request.values).length > 0
            ? { values: request.values }
            : {}),
        },
        name: request.name,
        refresh: request.refresh ?? "blocking",
      }),
      signal: request.signal,
      cache: "no-store",
    })
  } catch (err) {
    return {
      ok: false,
      code: "query_failed",
      message: "Could not reach PostHog.",
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  const bodyText = await response.text()
  if (!response.ok) {
    return mapHttpFailure(response.status, bodyText)
  }

  try {
    const parsed = JSON.parse(bodyText) as {
      results?: unknown
      columns?: string[]
      is_cached?: boolean
    }
    const results = Array.isArray(parsed.results) ? parsed.results : []
    return {
      ok: true,
      results,
      columns: parsed.columns,
      isCached: parsed.is_cached,
    }
  } catch {
    return {
      ok: false,
      code: "query_failed",
      message: "PostHog returned an unreadable query response.",
    }
  }
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

export function asString(value: unknown): string {
  if (value == null) return ""
  return String(value)
}

export function changeRatio(
  current: number,
  previous: number | null
): number | null {
  if (previous == null || previous === 0) return null
  return (current - previous) / previous
}

/**
 * Server-only PostHog access checks.
 * Runs a harmless HogQL query that requires `query:read`.
 */

import {
  resolvePostHogConfig,
  type PostHogCredentials,
  type PostHogConfigResolution,
} from "@/lib/posthog/config"
import type { AnalyticsErrorCode } from "@/lib/analytics/types"

export interface PostHogAccessOk {
  ok: true
  credentials: PostHogCredentials
  /** Raw numeric result from `SELECT 1`. */
  sample: number | null
}

export interface PostHogAccessFailure {
  ok: false
  clientId: string
  code: AnalyticsErrorCode
  message: string
  /** HTTP status from PostHog when available. */
  httpStatus?: number
  /** Narrow scope / auth detail for operators. */
  detail?: string
}

export type PostHogAccessResult = PostHogAccessOk | PostHogAccessFailure

const HARMLESS_QUERY = "SELECT 1"

function mapHttpFailure(
  clientId: string,
  httpStatus: number,
  bodyText: string
): PostHogAccessFailure {
  let detail = bodyText.slice(0, 500)
  try {
    const parsed = JSON.parse(bodyText) as {
      detail?: string
      type?: string
      code?: string
      attr?: string | null
    }
    if (typeof parsed.detail === "string") detail = parsed.detail
    else if (typeof parsed.code === "string") detail = parsed.code
  } catch {
    // keep truncated body
  }

  if (httpStatus === 401) {
    return {
      ok: false,
      clientId,
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
      lower.includes("permission") ||
      lower.includes("not authorized")

    return {
      ok: false,
      clientId,
      code: scopeBlocked ? "insufficient_scope" : "invalid_credentials",
      message: scopeBlocked
        ? "PostHog personal API key is missing the query:read scope."
        : "PostHog denied access to this project.",
      httpStatus,
      detail,
    }
  }

  if (httpStatus === 404) {
    return {
      ok: false,
      clientId,
      code: "invalid_credentials",
      message: "PostHog project was not found for the configured project ID.",
      httpStatus,
      detail,
    }
  }

  if (httpStatus === 429) {
    return {
      ok: false,
      clientId,
      code: "rate_limited",
      message: "PostHog rate-limited the validation query.",
      httpStatus,
      detail,
    }
  }

  return {
    ok: false,
    clientId,
    code: "query_failed",
    message: `PostHog validation query failed with HTTP ${httpStatus}.`,
    httpStatus,
    detail,
  }
}

/**
 * POST a minimal HogQL query to confirm the key can use `query:read`
 * against the configured project.
 */
export async function validatePostHogAccess(
  credentials: PostHogCredentials,
  init?: { signal?: AbortSignal }
): Promise<PostHogAccessResult> {
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
          query: HARMLESS_QUERY,
        },
        name: "ampere_studio_posthog_access_check",
        refresh: "force_cache",
      }),
      signal: init?.signal,
      cache: "no-store",
    })
  } catch (err) {
    return {
      ok: false,
      clientId: credentials.clientId,
      code: "query_failed",
      message: "Could not reach PostHog to validate access.",
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  const bodyText = await response.text()

  if (!response.ok) {
    return mapHttpFailure(credentials.clientId, response.status, bodyText)
  }

  let sample: number | null = null
  try {
    const parsed = JSON.parse(bodyText) as { results?: unknown }
    const first = Array.isArray(parsed.results) ? parsed.results[0] : null
    if (Array.isArray(first) && typeof first[0] === "number") {
      sample = first[0]
    } else if (typeof first === "number") {
      sample = first
    }
  } catch {
    // Successful HTTP with unexpected body still counts as access OK.
  }

  return { ok: true, credentials, sample }
}

/**
 * Resolve active (or explicit) client credentials and validate `query:read`.
 */
export async function resolveAndValidatePostHogAccess(
  clientId?: string
): Promise<PostHogAccessResult> {
  const resolution: PostHogConfigResolution =
    await resolvePostHogConfig(clientId)

  if (resolution.status === "missing") {
    return {
      ok: false,
      clientId: resolution.clientId,
      code: "not_configured",
      message: "PostHog is not configured for this client.",
    }
  }

  if (resolution.status === "invalid") {
    return {
      ok: false,
      clientId: resolution.clientId,
      code: resolution.code,
      message: resolution.message,
    }
  }

  return validatePostHogAccess(resolution.credentials)
}

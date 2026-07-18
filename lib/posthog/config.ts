/**
 * Server-only PostHog credential resolution.
 *
 * Secrets live in `ampere/clients/keys` as:
 *   `${clientId}_posthog_key`         → personal API key (`phx_…`)
 *   `${clientId}_posthog_project_id`  → numeric project ID (e.g. `517539`)
 *
 * Never return the personal key to the browser or expose it via NEXT_PUBLIC_*.
 */

import { getClientKeysSecret } from "@/lib/aws/secrets"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  POSTHOG_PRIVATE_HOST,
  type AnalyticsConnectionState,
  type AnalyticsErrorCode,
} from "@/lib/analytics/types"

export const POSTHOG_KEY_SUFFIX = "_posthog_key" as const
export const POSTHOG_PROJECT_ID_SUFFIX = "_posthog_project_id" as const

/** Cabfresh PostHog project ID required by the analytics plan. */
export const CABFRESH_POSTHOG_PROJECT_ID = "517539" as const

export interface PostHogCredentials {
  clientId: string
  /** Personal API key. Server-only. Never serialize to client responses. */
  apiKey: string
  projectId: string
  host: typeof POSTHOG_PRIVATE_HOST
}

export type PostHogConfigResolution =
  | { status: "missing"; clientId: string }
  | {
      status: "invalid"
      clientId: string
      code: Extract<
        AnalyticsErrorCode,
        "invalid_credentials" | "insufficient_scope"
      >
      message: string
    }
  | { status: "ok"; credentials: PostHogCredentials }

function secretKeyName(clientId: string): string {
  return `${clientId}${POSTHOG_KEY_SUFFIX}`
}

function projectIdKeyName(clientId: string): string {
  return `${clientId}${POSTHOG_PROJECT_ID_SUFFIX}`
}

export function isNumericPostHogProjectId(value: string): boolean {
  return /^\d+$/.test(value)
}

/**
 * Read PostHog credentials for a client from Secrets Manager.
 * Returns null when the personal key is absent (coming-soon gate).
 * Throws nothing for soft "missing" states; callers inspect validity separately.
 */
export async function getPostHogCredentials(
  clientId: string
): Promise<PostHogCredentials | null> {
  const secret = await getClientKeysSecret()
  const apiKey = secret[secretKeyName(clientId)]?.trim()
  if (!apiKey) return null

  const projectId = secret[projectIdKeyName(clientId)]?.trim() ?? ""

  return {
    clientId,
    apiKey,
    projectId,
    host: POSTHOG_PRIVATE_HOST,
  }
}

/**
 * Resolve credentials for the active CMS client (or an explicit client id).
 * Distinguishes missing key (coming soon) from present-but-invalid config.
 */
export async function resolvePostHogConfig(
  clientId?: string
): Promise<PostHogConfigResolution> {
  const resolvedClientId = clientId ?? (await getActiveClientId())
  const credentials = await getPostHogCredentials(resolvedClientId)

  if (!credentials) {
    return { status: "missing", clientId: resolvedClientId }
  }

  if (!credentials.apiKey.startsWith("phx_")) {
    return {
      status: "invalid",
      clientId: resolvedClientId,
      code: "invalid_credentials",
      message:
        "PostHog personal API key is malformed. Expected a phx_ key in Secrets Manager.",
    }
  }

  if (!credentials.projectId) {
    return {
      status: "invalid",
      clientId: resolvedClientId,
      code: "invalid_credentials",
      message: `Missing ${projectIdKeyName(resolvedClientId)} in Secrets Manager.`,
    }
  }

  if (!isNumericPostHogProjectId(credentials.projectId)) {
    return {
      status: "invalid",
      clientId: resolvedClientId,
      code: "invalid_credentials",
      message: `PostHog project ID must be numeric. Update ${projectIdKeyName(resolvedClientId)} (expected something like ${CABFRESH_POSTHOG_PROJECT_ID}).`,
    }
  }

  return { status: "ok", credentials }
}

/** Browser-safe connection summary. Never includes the personal API key. */
export function toAnalyticsConnectionState(
  resolution: PostHogConfigResolution
): AnalyticsConnectionState {
  if (resolution.status === "missing") {
    return { state: "unavailable" }
  }
  if (resolution.status === "invalid") {
    return {
      state: "error",
      code: resolution.code,
      message: resolution.message,
    }
  }
  return {
    state: "ready",
    projectId: resolution.credentials.projectId,
  }
}

/**
 * Redact credentials for logs. Safe to print.
 */
export function describePostHogCredentials(
  credentials: PostHogCredentials
): string {
  const keyHint =
    credentials.apiKey.length > 8
      ? `${credentials.apiKey.slice(0, 4)}…${credentials.apiKey.slice(-4)}`
      : "(short)"
  return `client=${credentials.clientId} projectId=${credentials.projectId} key=${keyHint} host=${credentials.host}`
}

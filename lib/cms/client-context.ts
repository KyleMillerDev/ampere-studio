import { cookies } from "next/headers"

import { isAuthConfigured } from "@/lib/auth/amplify-config"
import { getAuthenticatedUserClientId } from "@/lib/auth/user-client"
import { CLIENT_ID } from "@/lib/cms/constants"

export const ACTIVE_CLIENT_COOKIE = "ampere_dev_client_id"

export function isDevClientSwitchEnabled(): boolean {
  return process.env.NODE_ENV === "development"
}

async function getDevClientCookie(): Promise<string | null> {
  if (!isDevClientSwitchEnabled()) return null

  try {
    const cookieStore = await cookies()
    const selectedClientId = cookieStore.get(ACTIVE_CLIENT_COOKIE)?.value.trim()
    return selectedClientId || null
  } catch {
    return null
  }
}

/**
 * Resolves the active CMS client_id for the current request.
 *
 * - Development: dev dropdown cookie overrides when set.
 * - Otherwise: Cognito `custom:client_id` on the signed-in user.
 * - Development without auth configured: falls back to `AMPERE_DEFAULT_CLIENT_ID`.
 */
export async function getActiveClientId(): Promise<string> {
  const devClientId = await getDevClientCookie()
  if (devClientId) return devClientId

  const userClientId = await getAuthenticatedUserClientId()
  if (userClientId) return userClientId

  if (isAuthConfigured) {
    throw new Error(
      "Missing custom:client_id on the signed-in user. Set it in the Cognito console when creating the user."
    )
  }

  return CLIENT_ID
}

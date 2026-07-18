import { cookies } from "next/headers"
import {
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
} from "aws-amplify/auth/server"

import { isAuthConfigured } from "@/lib/auth/amplify-config"
import { COGNITO_CLIENT_ID_ATTRIBUTE } from "@/lib/auth/constants"
import { runWithAmplifyServerContext } from "@/lib/auth/server"

export interface AuthenticatedUserContext {
  /** Cognito `sub` (stable user id). */
  cognitoSub: string
  /** Cognito `custom:client_id`. */
  clientId: string
}

/**
 * Returns the signed-in user's Cognito `custom:client_id`, or null when
 * unauthenticated / attribute missing.
 */
export async function getAuthenticatedUserClientId(): Promise<string | null> {
  const user = await getAuthenticatedUserContext()
  return user?.clientId ?? null
}

/**
 * Authenticated Cognito context for analytics (and other) API routes.
 * Every analytics route must call this itself; middleware alone is not enough
 * because `/api/*` is public in the matcher.
 */
export async function getAuthenticatedUserContext(): Promise<AuthenticatedUserContext | null> {
  if (!isAuthConfigured) return null

  try {
    return await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (contextSpec) => {
        try {
          const [user, attributes, session] = await Promise.all([
            getCurrentUser(contextSpec),
            fetchUserAttributes(contextSpec),
            fetchAuthSession(contextSpec),
          ])

          const clientId = attributes[COGNITO_CLIENT_ID_ATTRIBUTE]?.trim()
          if (!clientId) return null

          const cognitoSub =
            user.userId?.trim() ||
            attributes.sub?.trim() ||
            session.tokens?.idToken?.payload?.sub?.toString()?.trim() ||
            ""

          if (!cognitoSub) return null

          return { cognitoSub, clientId }
        } catch {
          return null
        }
      },
    })
  } catch {
    return null
  }
}

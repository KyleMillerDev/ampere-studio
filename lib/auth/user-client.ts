import { cookies } from "next/headers"
import { fetchUserAttributes } from "aws-amplify/auth/server"

import { isAuthConfigured } from "@/lib/auth/amplify-config"
import { COGNITO_CLIENT_ID_ATTRIBUTE } from "@/lib/auth/constants"
import { runWithAmplifyServerContext } from "@/lib/auth/server"

export async function getAuthenticatedUserClientId(): Promise<string | null> {
  if (!isAuthConfigured) return null

  try {
    return await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (contextSpec) => {
        try {
          const attributes = await fetchUserAttributes(contextSpec)
          const clientId = attributes[COGNITO_CLIENT_ID_ATTRIBUTE]?.trim()
          return clientId || null
        } catch {
          return null
        }
      },
    })
  } catch {
    return null
  }
}

import { NextResponse } from "next/server"

import {
  analyticsErrorResponse,
  analyticsUnknownErrorResponse,
} from "@/app/api/analytics/errors"
import type { AnalyticsErrorCode } from "@/lib/analytics/types"
import { getAuthenticatedUserContext } from "@/lib/auth/user-client"
import { getActiveClientId } from "@/lib/cms/client-context"
import { resolveAndValidatePostHogAccess } from "@/lib/posthog/validate"
import { fetchAnalyticsLive } from "@/lib/posthog/query"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUserContext()
    if (!user) {
      return analyticsErrorResponse("unauthorized", "Sign in required.", 401)
    }

    const clientId = await getActiveClientId()
    const access = await resolveAndValidatePostHogAccess(clientId)
    if (!access.ok) {
      return analyticsErrorResponse(access.code, access.message)
    }

    const result = await fetchAnalyticsLive(access.credentials, {
      signal: req.signal,
    })
    if (!result.ok) {
      return analyticsErrorResponse(
        result.code as AnalyticsErrorCode,
        result.message
      )
    }

    return NextResponse.json(result.data)
  } catch (err) {
    return analyticsUnknownErrorResponse(err)
  }
}

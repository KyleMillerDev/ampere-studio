import { NextResponse } from "next/server"

import {
  analyticsErrorResponse,
  analyticsUnknownErrorResponse,
  analyticsZodErrorResponse,
} from "@/app/api/analytics/errors"
import { analyticsDashboardRequestSchema } from "@/lib/analytics/schemas"
import { getAuthenticatedUserContext } from "@/lib/auth/user-client"
import { getActiveClientId } from "@/lib/cms/client-context"
import { resolveAndValidatePostHogAccess } from "@/lib/posthog/validate"
import { fetchAnalyticsDashboard } from "@/lib/posthog/query"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUserContext()
    if (!user) {
      return analyticsErrorResponse("unauthorized", "Sign in required.", 401)
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return analyticsErrorResponse(
        "validation_error",
        "Request body must be JSON.",
        400
      )
    }

    const parsed = analyticsDashboardRequestSchema.safeParse(body)
    if (!parsed.success) {
      return analyticsZodErrorResponse(parsed.error)
    }

    // Respect the CMS "Viewing as" client in development; Cognito client otherwise.
    const clientId = await getActiveClientId()
    const access = await resolveAndValidatePostHogAccess(clientId)
    if (!access.ok) {
      return analyticsErrorResponse(access.code, access.message)
    }

    const data = await fetchAnalyticsDashboard(access.credentials, parsed.data, {
      signal: req.signal,
    })

    // Credentials never leave the server.
    return NextResponse.json(data)
  } catch (err) {
    return analyticsUnknownErrorResponse(err)
  }
}

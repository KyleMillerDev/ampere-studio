import { NextResponse } from "next/server"

import {
  analyticsErrorResponse,
  analyticsUnknownErrorResponse,
  analyticsZodErrorResponse,
} from "@/app/api/analytics/errors"
import { analyticsLayoutPutSchema } from "@/lib/analytics/schemas"
import { getAuthenticatedUserContext } from "@/lib/auth/user-client"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  deleteAnalyticsLayout,
  getAnalyticsLayout,
  putAnalyticsLayout,
} from "@/lib/cms/analytics-layouts"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getAuthenticatedUserContext()
    if (!user) {
      return analyticsErrorResponse("unauthorized", "Sign in required.", 401)
    }

    const clientId = await getActiveClientId()
    const layout = await getAnalyticsLayout(clientId, user.cognitoSub)
    return NextResponse.json({ layout })
  } catch (err) {
    return analyticsUnknownErrorResponse(err)
  }
}

export async function PUT(req: Request) {
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

    const parsed = analyticsLayoutPutSchema.safeParse(body)
    if (!parsed.success) {
      return analyticsZodErrorResponse(parsed.error)
    }

    const clientId = await getActiveClientId()
    const layout = await putAnalyticsLayout(
      clientId,
      user.cognitoSub,
      parsed.data
    )
    return NextResponse.json({ layout })
  } catch (err) {
    return analyticsUnknownErrorResponse(err)
  }
}

/** Reset to the six-widget default by deleting the saved layout row. */
export async function DELETE() {
  try {
    const user = await getAuthenticatedUserContext()
    if (!user) {
      return analyticsErrorResponse("unauthorized", "Sign in required.", 401)
    }

    const clientId = await getActiveClientId()
    const layout = await deleteAnalyticsLayout(clientId, user.cognitoSub)
    return NextResponse.json({ layout, reset: true })
  } catch (err) {
    return analyticsUnknownErrorResponse(err)
  }
}

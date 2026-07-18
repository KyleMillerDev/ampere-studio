import { NextResponse } from "next/server"
import { ZodError } from "zod"

import type { AnalyticsErrorCode } from "@/lib/analytics/types"
import { userFacingAnalyticsMessage } from "@/lib/analytics/user-facing"

export function analyticsErrorResponse(
  code: AnalyticsErrorCode,
  message: string,
  status?: number
): NextResponse {
  const resolvedStatus =
    status ??
    (code === "unauthorized"
      ? 401
      : code === "not_configured"
        ? 503
        : code === "validation_error"
          ? 400
          : code === "not_found"
            ? 404
            : code === "rate_limited"
              ? 429
              : code === "invalid_credentials" || code === "insufficient_scope"
                ? 502
                : 500)

  // Never include personal API keys or provider names in client responses.
  const safeMessage = userFacingAnalyticsMessage(message)

  return NextResponse.json(
    { error: safeMessage, code },
    { status: resolvedStatus }
  )
}

export function analyticsZodErrorResponse(err: ZodError): NextResponse {
  return analyticsErrorResponse(
    "validation_error",
    err.issues.map((issue) => issue.message).join("; ") || "Invalid request.",
    400
  )
}

export function analyticsUnknownErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) return analyticsZodErrorResponse(err)
  const message =
    err instanceof Error ? err.message : "Unexpected analytics error."
  return analyticsErrorResponse("unknown", message, 500)
}

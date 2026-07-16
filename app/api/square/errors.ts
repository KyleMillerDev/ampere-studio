import { NextResponse } from "next/server"

export function squareErrorResponse(err: unknown): NextResponse {
  console.error("[square-api]", err)

  if (err instanceof Error) {
    // Square SDK ApiError
    const apiErr = err as Error & { statusCode?: number; body?: unknown }
    if (apiErr.statusCode) {
      return NextResponse.json(
        { error: "Square API error", details: apiErr.body ?? apiErr.message },
        { status: apiErr.statusCode }
      )
    }

    // Validation / business-rule errors we raised explicitly
    if (
      err.message.includes("exceeds") ||
      err.message.includes("required") ||
      err.message.includes("limit") ||
      err.message.includes("not found")
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    // Configuration errors
    if (
      err.message.includes("not configured") ||
      err.message.includes("Square is not")
    ) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

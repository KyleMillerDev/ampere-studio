import { NextResponse } from "next/server"

import { StripeNotConfiguredError } from "@/lib/stripe/products"

/** Map Stripe/library errors to a JSON response shared by all stripe routes. */
export function stripeErrorResponse(err: unknown): NextResponse {
  if (err instanceof StripeNotConfiguredError) {
    return NextResponse.json(
      { error: "Stripe is not configured for this client" },
      { status: 503 }
    )
  }
  const e = err as { type?: string; statusCode?: number; message?: string }
  if (typeof e?.type === "string" && e.type.startsWith("Stripe")) {
    return NextResponse.json(
      { error: e.message ?? "Stripe request failed" },
      { status: e.statusCode && e.statusCode < 500 ? e.statusCode : 502 }
    )
  }
  throw err
}

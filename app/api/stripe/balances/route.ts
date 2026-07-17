import { NextResponse } from "next/server"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { getStripeBalancesSummary } from "@/lib/stripe/balances"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const enabled = await isStripeOrdersEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Stripe is not configured for this client" },
        { status: 503 }
      )
    }
    const summary = await getStripeBalancesSummary()
    return NextResponse.json(summary)
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

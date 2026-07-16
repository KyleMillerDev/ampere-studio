import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { computeDashboardSummary } from "@/lib/square/orders"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    const summary = await computeDashboardSummary({
      dateFrom: searchParams.get("from") ?? thirtyDaysAgo.toISOString().slice(0, 10),
      dateTo: searchParams.get("to") ?? now.toISOString().slice(0, 10),
      status: searchParams.get("status") ?? "ALL",
      fulfillment: searchParams.get("fulfillment") ?? "ALL",
      productName: searchParams.get("product") ?? undefined,
      categoryName: searchParams.get("category") ?? undefined,
      minAmount: searchParams.get("min") ? Number(searchParams.get("min")) : undefined,
      maxAmount: searchParams.get("max") ? Number(searchParams.get("max")) : undefined,
    })
    return NextResponse.json(summary)
  } catch (err) {
    return squareErrorResponse(err)
  }
}

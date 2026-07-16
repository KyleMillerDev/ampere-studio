import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { listSquareOrders } from "@/lib/square/orders"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!)
    : undefined
  try {
    const orders = await listSquareOrders({ limit })
    return NextResponse.json({ orders })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

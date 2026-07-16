import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { getSquareOrder } from "@/lib/square/orders"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const order = await getSquareOrder(id)
    if (!order)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    return NextResponse.json({ order })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

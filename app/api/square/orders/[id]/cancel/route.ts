import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { cancelOrder } from "@/lib/square/orders"

export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const order = await cancelOrder(id)
    return NextResponse.json({ order })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import { updateOrderFulfillment } from "@/lib/square/orders"
import { updateFulfillmentSchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = updateFulfillmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const order = await updateOrderFulfillment(
      id,
      parsed.data.uid,
      parsed.data.state,
      {
        carrier: parsed.data.carrier,
        tracking_number: parsed.data.tracking_number,
      }
    )
    return NextResponse.json({ order })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

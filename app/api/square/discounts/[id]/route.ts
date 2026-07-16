import { NextResponse } from "next/server"

import { squareErrorResponse } from "@/app/api/square/errors"
import { deleteSquareDiscount } from "@/lib/square/discounts"

export const dynamic = "force-dynamic"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await deleteSquareDiscount(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

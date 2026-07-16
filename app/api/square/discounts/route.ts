import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import {
  createSquareDiscount,
  listSquareDiscounts,
} from "@/lib/square/discounts"
import { createDiscountSchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const discounts = await listSquareDiscounts()
    return NextResponse.json({ discounts })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = createDiscountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const discount = await createSquareDiscount(parsed.data)
    return NextResponse.json({ discount }, { status: 201 })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

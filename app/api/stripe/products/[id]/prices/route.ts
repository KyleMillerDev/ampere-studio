import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { createPrice } from "@/lib/stripe/products"
import { stripePriceCreateSchema } from "@/lib/validation/stripe-product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = stripePriceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const price = await createPrice(id, parsed.data)
    return NextResponse.json({ price }, { status: 201 })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

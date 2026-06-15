import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { setPriceActive } from "@/lib/stripe/products"
import { stripePriceUpdateSchema } from "@/lib/validation/stripe-product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = stripePriceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const price = await setPriceActive(id, parsed.data.active)
    return NextResponse.json({ price })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

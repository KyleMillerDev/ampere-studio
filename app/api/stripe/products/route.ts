import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { createStripeProduct, listStripeProducts } from "@/lib/stripe/products"
import { stripeProductCreateSchema } from "@/lib/validation/stripe-product.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const products = await listStripeProducts()
    return NextResponse.json({ products })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = stripeProductCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await createStripeProduct(parsed.data)
    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

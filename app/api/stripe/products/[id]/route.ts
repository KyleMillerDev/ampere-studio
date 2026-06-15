import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import {
  archiveStripeProduct,
  getStripeProduct,
  updateStripeProduct,
} from "@/lib/stripe/products"
import { stripeProductUpdateSchema } from "@/lib/validation/stripe-product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const product = await getStripeProduct(id)
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ product })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = stripeProductUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await updateStripeProduct(id, parsed.data)
    return NextResponse.json({ product })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

/** Stripe products with prices can't be hard-deleted, so DELETE archives. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const product = await archiveStripeProduct(id)
    return NextResponse.json({ ok: true, product })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

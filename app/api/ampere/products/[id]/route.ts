import { NextResponse } from "next/server"
import { z } from "zod"

import { ampereErrorResponse } from "@/app/api/ampere/errors"
import {
  archiveAmpereProduct,
  getAmpereProduct,
  updateAmpereProduct,
} from "@/lib/ampere/products"
import { ampereProductUpdateSchema } from "@/lib/validation/ampere-product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const product = await getAmpereProduct(id)
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ product })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = ampereProductUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await updateAmpereProduct(id, parsed.data)
    return NextResponse.json({ product })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

/** Products stay in the catalog. DELETE archives them, same as Stripe. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const product = await archiveAmpereProduct(id)
    return NextResponse.json({ ok: true, product })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

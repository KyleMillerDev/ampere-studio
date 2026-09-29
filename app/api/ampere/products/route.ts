import { NextResponse } from "next/server"
import { z } from "zod"

import { ampereErrorResponse } from "@/app/api/ampere/errors"
import {
  createAmpereProduct,
  listAmpereProducts,
} from "@/lib/ampere/products"
import { ampereProductCreateSchema } from "@/lib/validation/ampere-product.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const products = await listAmpereProducts()
    return NextResponse.json({ products })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = ampereProductCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await createAmpereProduct(parsed.data)
    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

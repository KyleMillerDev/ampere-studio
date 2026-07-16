import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import { createSquareProduct, listSquareProducts } from "@/lib/square/products"
import { createProductSchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const products = await listSquareProducts()
    return NextResponse.json({ products })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await createSquareProduct(parsed.data)
    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

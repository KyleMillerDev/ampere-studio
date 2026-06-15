import { NextResponse } from "next/server"
import { z } from "zod"

import { createProduct, listProducts } from "@/lib/cms/products"
import { productCreateSchema } from "@/lib/validation/product.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  const products = await listProducts()
  return NextResponse.json({ products })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = productCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  const product = await createProduct(parsed.data)
  return NextResponse.json({ product }, { status: 201 })
}

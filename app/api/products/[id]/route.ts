import { NextResponse } from "next/server"
import { z } from "zod"

import { deleteProduct, getProduct, updateProduct } from "@/lib/cms/products"
import { productUpdateSchema } from "@/lib/validation/product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ product })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = productUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await updateProduct(id, parsed.data)
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ product })
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  await deleteProduct(id)
  return NextResponse.json({ ok: true })
}

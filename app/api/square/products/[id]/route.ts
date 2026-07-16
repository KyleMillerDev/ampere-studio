import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import {
  deleteSquareProduct,
  getSquareProduct,
  updateSquareProduct,
} from "@/lib/square/products"
import { updateProductSchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const product = await getSquareProduct(id)
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    return NextResponse.json({ product })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const product = await updateSquareProduct(id, parsed.data)
    return NextResponse.json({ product })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await deleteSquareProduct(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

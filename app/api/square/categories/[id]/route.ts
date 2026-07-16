import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import {
  deleteSquareCategory,
  getSquareCategory,
  updateSquareCategory,
} from "@/lib/square/categories"
import { updateCategorySchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const category = await getSquareCategory(id)
    if (!category)
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    return NextResponse.json({ category })
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
  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const category = await updateSquareCategory(id, parsed.data)
    return NextResponse.json({ category })
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
    await deleteSquareCategory(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

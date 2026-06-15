import { NextResponse } from "next/server"
import { z } from "zod"

import {
  deleteCategory,
  getCategory,
  updateCategory,
} from "@/lib/cms/categories"
import { categoryUpdateSchema } from "@/lib/validation/category.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const category = await getCategory(id)
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ category })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = categoryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const category = await updateCategory(id, parsed.data)
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ category })
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
  await deleteCategory(id)
  return NextResponse.json({ ok: true })
}

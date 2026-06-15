import { NextResponse } from "next/server"
import { z } from "zod"

import { createCategory, listCategories } from "@/lib/cms/categories"
import { categoryCreateSchema } from "@/lib/validation/category.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  const categories = await listCategories()
  return NextResponse.json({ categories })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = categoryCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  const category = await createCategory(parsed.data)
  return NextResponse.json({ category }, { status: 201 })
}

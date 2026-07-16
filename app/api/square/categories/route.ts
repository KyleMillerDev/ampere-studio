import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import {
  createSquareCategory,
  listSquareCategories,
} from "@/lib/square/categories"
import { createCategorySchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const categories = await listSquareCategories()
    return NextResponse.json({ categories })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const category = await createSquareCategory(parsed.data)
    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

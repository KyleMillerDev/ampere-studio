import { NextResponse } from "next/server"
import { z } from "zod"

import { ampereErrorResponse } from "@/app/api/ampere/errors"
import { createAmperePrice } from "@/lib/ampere/products"
import { amperePriceCreateSchema } from "@/lib/validation/ampere-product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = amperePriceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const price = await createAmperePrice(id, parsed.data)
    return NextResponse.json({ price }, { status: 201 })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"

import { ampereErrorResponse } from "@/app/api/ampere/errors"
import { setAmperePriceActive } from "@/lib/ampere/products"
import { amperePriceUpdateSchema } from "@/lib/validation/ampere-product.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = amperePriceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const price = await setAmperePriceActive(id, parsed.data.active)
    return NextResponse.json({ price })
  } catch (err) {
    return ampereErrorResponse(err)
  }
}

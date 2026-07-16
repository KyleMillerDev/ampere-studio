import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { setStatusOverride } from "@/lib/stripe/orders"
import { setStatusSchema } from "@/lib/validation/order.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isStripeOrdersEnabled())) {
    return NextResponse.json({ error: "Orders not available" }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = setStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const order = await setStatusOverride(id, parsed.data.status_override)
    return NextResponse.json({ order })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { updateOrderItems } from "@/lib/stripe/orders"
import { editOrderItemsSchema } from "@/lib/validation/order.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isStripeOrdersEnabled())) {
    return NextResponse.json({ error: "Orders not available" }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = editOrderItemsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const { order, delta } = await updateOrderItems(id, {
      items: parsed.data.items,
      discountAmount: parsed.data.discountAmount,
    })
    return NextResponse.json({ order, delta })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

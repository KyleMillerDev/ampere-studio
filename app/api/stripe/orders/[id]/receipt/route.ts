import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { getStripeOrder } from "@/lib/stripe/orders"
import { sendReceiptSchema } from "@/lib/validation/order.schema"
import { sendReceiptEmail } from "@/lib/email/order-emails"
import { getActiveClient } from "@/lib/cms/clients"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isStripeOrdersEnabled())) {
    return NextResponse.json({ error: "Orders not available" }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = sendReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const [order, client] = await Promise.all([
      getStripeOrder(id),
      getActiveClient(),
    ])
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    await sendReceiptEmail({
      order,
      client,
      to: parsed.data.to,
      bcc: parsed.data.bcc,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"

import { stripeErrorResponse } from "@/app/api/stripe/errors"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { addTracking, getStripeOrder } from "@/lib/stripe/orders"
import { addTrackingSchema } from "@/lib/validation/order.schema"
import { sendShipmentNotification } from "@/lib/email/order-emails"
import { getActiveClient } from "@/lib/cms/clients"
import { requestOrigin } from "@/lib/url"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isStripeOrdersEnabled())) {
    return NextResponse.json({ error: "Orders not available" }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = addTrackingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const { tracking, tracking_carrier, notify_customer } = parsed.data
    const order = await addTracking(id, { tracking, tracking_carrier })

    if (notify_customer && order.customerEmail) {
      const [client] = await Promise.all([getActiveClient()])
      const origin = requestOrigin(req)
      await sendShipmentNotification({
        order,
        client,
        dashboardOrigin: origin,
      }).catch(() => {})
    }

    return NextResponse.json({ order })
  } catch (err) {
    return stripeErrorResponse(err)
  }
}

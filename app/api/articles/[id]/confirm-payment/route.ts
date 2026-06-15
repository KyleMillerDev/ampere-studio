import { NextResponse } from "next/server"
import { z } from "zod"

import { getArticle, markArticlePaidAndPublish } from "@/lib/cms/articles"
import {
  PlatformStripeNotConfiguredError,
  retrieveCheckoutSession,
} from "@/lib/stripe/platform"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const confirmSchema = z.object({
  sessionId: z.string().min(1),
})

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const article = await getArticle(id)
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (article.paidAt) {
    return NextResponse.json({ article })
  }

  try {
    const session = await retrieveCheckoutSession(parsed.data.sessionId)
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 402 }
      )
    }
    if (session.metadata?.articleId !== id) {
      return NextResponse.json(
        { error: "Checkout session does not match this article" },
        { status: 400 }
      )
    }

    const updated = await markArticlePaidAndPublish(id)
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ article: updated })
  } catch (err) {
    if (err instanceof PlatformStripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message =
      err instanceof Error ? err.message : "Payment confirmation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

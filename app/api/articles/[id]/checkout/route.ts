import { NextResponse } from "next/server"

import { getArticle } from "@/lib/cms/articles"
import {
  createAiArticleCheckoutSession,
  PlatformStripeNotConfiguredError,
} from "@/lib/stripe/platform"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "http"
  if (host) return `${proto}://${host}`
  return new URL(req.url).origin
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!article.aiGenerated) {
    return NextResponse.json(
      { error: "This article was not AI-generated" },
      { status: 400 }
    )
  }
  if (article.paidAt) {
    return NextResponse.json(
      { error: "This article has already been paid for" },
      { status: 400 }
    )
  }

  try {
    const url = await createAiArticleCheckoutSession({
      articleId: id,
      origin: requestOrigin(req),
    })
    return NextResponse.json({ url })
  } catch (err) {
    if (err instanceof PlatformStripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : "Checkout failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

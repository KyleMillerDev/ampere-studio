import { NextResponse } from "next/server"
import { z } from "zod"

import {
  ArticlePaymentRequiredError,
  createArticle,
  listArticles,
} from "@/lib/cms/articles"
import { articleCreateSchema } from "@/lib/validation/article.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  const articles = await listArticles()
  return NextResponse.json({ articles })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = articleCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const article = await createArticle(parsed.data)
    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    if (err instanceof ArticlePaymentRequiredError) {
      return NextResponse.json(
        {
          error: "payment_required",
          requiresPayment: true,
          article: err.article,
        },
        { status: 402 }
      )
    }
    throw err
  }
}

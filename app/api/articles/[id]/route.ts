import { NextResponse } from "next/server"
import { z } from "zod"

import {
  ArticlePaymentRequiredError,
  deleteArticle,
  getArticle,
  updateArticle,
} from "@/lib/cms/articles"
import { articleUpdateSchema } from "@/lib/validation/article.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ article })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = articleUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const article = await updateArticle(id, parsed.data)
    if (!article)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ article })
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
    const name = (err as { name?: string })?.name
    if (name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  await deleteArticle(id)
  return NextResponse.json({ ok: true })
}

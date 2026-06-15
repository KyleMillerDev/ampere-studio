import { NextResponse } from "next/server"
import { z } from "zod"

import { generateArticle } from "@/lib/ai/openrouter"
import { getActiveClientProfile } from "@/lib/cms/clients"

export const dynamic = "force-dynamic"

const generateSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const profile = await getActiveClientProfile()
    const result = await generateArticle({
      company: profile.name,
      industry: profile.industry,
      title: parsed.data.title,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Article generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

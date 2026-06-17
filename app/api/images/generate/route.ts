import { NextResponse } from "next/server"
import { z } from "zod"

import {
  generateStudioImageForArticle,
  generateStudioImageFromMediaPrompt,
} from "@/lib/ai/openrouter"
import { saveGeneratedImage } from "@/lib/cms/save-generated-image"

export const dynamic = "force-dynamic"

const mediaSchema = z.object({
  source: z.literal("media"),
  prompt: z.string().min(3, "Describe the image you want").max(2000),
  alt: z.string().max(500).optional(),
})

const articleSchema = z.object({
  source: z.literal("article"),
  title: z.string().min(1, "Title is required").max(300),
  body: z.string().min(1, "Article body is required").max(100_000),
  alt: z.string().max(500).optional(),
})

const generateSchema = z.discriminatedUnion("source", [
  mediaSchema,
  articleSchema,
])

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
    const generated =
      parsed.data.source === "media"
        ? await generateStudioImageFromMediaPrompt({
            userText: parsed.data.prompt,
            alt: parsed.data.alt,
          })
        : await generateStudioImageForArticle({
            title: parsed.data.title,
            body: parsed.data.body,
          })

    const alt =
      parsed.data.alt?.trim() ||
      (parsed.data.source === "article"
        ? parsed.data.title.trim()
        : parsed.data.prompt.trim().slice(0, 120))

    const image = await saveGeneratedImage({
      imageUrl: generated.imageUrl,
      alt,
      filenamePrefix:
        parsed.data.source === "article" ? "article-thumbnail" : "ai-generated",
    })

    return NextResponse.json({
      image,
      prompt: generated.prompt,
      model: generated.model,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

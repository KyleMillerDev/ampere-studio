import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import { generateImageFromPrompt } from "@/lib/ai/openrouter"

export const dynamic = "force-dynamic"

const imageRequestSchema = z.object({
  product_name: z.string().min(1),
  description: z.string().optional(),
  category_names: z.array(z.string()).optional(),
  style: z
    .enum(["dramatic", "close_up", "environment", "flat_lay"])
    .optional()
    .default("dramatic"),
})

const stylePrompts: Record<string, string> = {
  dramatic:
    "dramatic product photography, studio lighting, dark moody background, high contrast",
  close_up:
    "extreme close-up macro product shot, sharp focus, soft bokeh background",
  environment:
    "product in natural lifestyle environment, editorial photography",
  flat_lay:
    "flat lay product photography, minimalist, overhead shot, clean white background",
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = imageRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const { product_name, description, category_names, style } = parsed.data
  const categories = category_names?.join(", ") ?? ""
  const styleDesc = stylePrompts[style]

  const prompt = `${styleDesc}, product: ${product_name}${categories ? `, category: ${categories}` : ""}${description ? `, described as: ${description}` : ""}. Professional product photography, high quality, commercial use.`

  try {
    const result = await generateImageFromPrompt(prompt)
    return NextResponse.json({
      imageUrl: result.imageUrl,
      model: result.model,
      prompt,
    })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"
import { OpenRouter } from "@openrouter/sdk"

import { squareErrorResponse } from "@/app/api/square/errors"

export const dynamic = "force-dynamic"

const descriptionRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category_names: z.array(z.string()).optional(),
  price: z.number().optional(),
  variation_names: z.array(z.string()).optional(),
  image_urls: z.array(z.string()).optional(),
})

function getOpenRouter(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured")
  return new OpenRouter({ apiKey })
}

/** POST /api/square/ai/description — generate 3 product description suggestions. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = descriptionRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const { name, description, category_names, price, variation_names } =
    parsed.data
  const priceFormatted = price ? `$${(price / 100).toFixed(2)}` : ""
  const categories = category_names?.join(", ") ?? ""
  const variations = variation_names?.join(", ") ?? ""

  const prompt = `You are writing product descriptions for a Square commerce store.
Generate 3 distinct, engaging product descriptions for the following item. Each description should be 1-3 sentences, conversational, and highlight the product's value.

Product name: ${name}
${priceFormatted ? `Price: ${priceFormatted}` : ""}
${categories ? `Categories: ${categories}` : ""}
${variations ? `Available as: ${variations}` : ""}
${description ? `Existing description: ${description}` : ""}

Return ONLY a JSON array of 3 strings, like: ["Description 1", "Description 2", "Description 3"]`

  try {
    const openrouter = getOpenRouter()
    const model =
      process.env.OPENROUTER_PRODUCT_MODEL?.trim() ||
      "~anthropic/claude-sonnet-latest"
    const result = openrouter.callModel({
      model,
      input: prompt,
      temperature: 0.8,
      maxOutputTokens: 512,
    })
    const text = (await result.getText()).trim()

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error("Could not parse description suggestions")

    const descriptions = JSON.parse(jsonMatch[0]) as unknown
    if (!Array.isArray(descriptions)) throw new Error("Invalid response format")

    const valid = descriptions
      .filter((d): d is string => typeof d === "string")
      .map((d) => d.trim())
      .filter(Boolean)
      .slice(0, 3)

    if (valid.length === 0) throw new Error("No descriptions were generated")

    return NextResponse.json({ descriptions: valid })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

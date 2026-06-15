import { NextResponse } from "next/server"
import { z } from "zod"

import { finalizeImage } from "@/lib/cms/images"

export const dynamic = "force-dynamic"

const finalizeSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().max(500).optional(),
  sizeBytes: z.number().int().positive().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = finalizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const image = await finalizeImage(id, parsed.data)
    if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ image })
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw err
  }
}

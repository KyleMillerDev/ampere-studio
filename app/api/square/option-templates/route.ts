import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import {
  createOptionPreset,
  listOptionPresets,
} from "@/lib/square/option-templates"
import { optionPresetSchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const presets = await listOptionPresets()
    return NextResponse.json({ presets })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = optionPresetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const preset = await createOptionPreset(parsed.data)
    return NextResponse.json({ preset }, { status: 201 })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

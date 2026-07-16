import { NextResponse } from "next/server"
import { z } from "zod"

import { squareErrorResponse } from "@/app/api/square/errors"
import {
  deleteOptionPreset,
  getOptionPreset,
  updateOptionPreset,
} from "@/lib/square/option-templates"
import { optionPresetSchema } from "@/lib/validation/square.schema"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const preset = await getOptionPreset(id)
    if (!preset)
      return NextResponse.json(
        { error: "Option preset not found" },
        { status: 404 }
      )
    return NextResponse.json({ preset })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = optionPresetSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }
  try {
    const preset = await updateOptionPreset(id, parsed.data)
    return NextResponse.json({ preset })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await deleteOptionPreset(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return squareErrorResponse(err)
  }
}

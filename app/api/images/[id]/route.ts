import { NextResponse } from "next/server"

import { deleteImage, getImage } from "@/lib/cms/images"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const image = await getImage(id)
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ image })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  await deleteImage(id)
  return NextResponse.json({ ok: true })
}

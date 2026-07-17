import { NextResponse } from "next/server"
import { z } from "zod"

import { bulkDeleteSubmissions, listSubmissions } from "@/lib/cms/submissions"

export const dynamic = "force-dynamic"

const deleteSchema = z.object({
  items: z
    .array(
      z.object({
        submissionId: z.string().min(1),
        timestamp: z.string().min(1),
      })
    )
    .min(1)
    .max(200),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam
    ? Math.max(1, Math.min(500, Number(limitParam)))
    : undefined
  const submissions = await listSubmissions({ limit })
  return NextResponse.json({ submissions })
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = deleteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    await bulkDeleteSubmissions(parsed.data.items)
    return NextResponse.json({ ok: true, deleted: parsed.data.items.length })
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === "ConditionalCheckFailedException") {
      return NextResponse.json(
        { error: "One or more submissions were not found for this client." },
        { status: 404 }
      )
    }
    throw err
  }
}

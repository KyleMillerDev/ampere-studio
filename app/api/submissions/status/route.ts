import { NextResponse } from "next/server"
import { z } from "zod"

import {
  bulkUpdateSubmissionStatus,
  type SubmissionStatus,
} from "@/lib/cms/submissions"

export const dynamic = "force-dynamic"

const statusSchema = z.object({
  status: z.enum(["new", "read", "archived"]),
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

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = statusSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const { status, items } = parsed.data

  try {
    await bulkUpdateSubmissionStatus(items, status as SubmissionStatus)
    return NextResponse.json({ ok: true, updated: items.length })
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

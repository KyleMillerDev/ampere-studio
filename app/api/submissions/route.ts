import { NextResponse } from "next/server"

import { listSubmissions } from "@/lib/cms/submissions"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : undefined
  const submissions = await listSubmissions({ limit })
  return NextResponse.json({ submissions })
}

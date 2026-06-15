import { NextResponse } from "next/server"

import { suggestArticleTitles } from "@/lib/ai/openrouter"
import { getActiveClientProfile } from "@/lib/cms/clients"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const topic = searchParams.get("seed")?.trim() || undefined

  try {
    const profile = await getActiveClientProfile()
    const suggestions = await suggestArticleTitles({
      company: profile.name,
      industry: profile.industry,
      topic,
    })
    return NextResponse.json({ suggestions })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Title suggestions failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"

import { putObjectBuffer } from "@/lib/aws/s3"
import { getImage } from "@/lib/cms/images"

export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024

type Ctx = { params: Promise<{ id: string }> }

/** Accept the file bytes server-side and PUT to S3 (avoids browser CORS to S3). */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const image = await getImage(id)
    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (image.status !== "pending") {
      return NextResponse.json(
        { error: "Image already uploaded" },
        { status: 409 }
      )
    }

    const body = Buffer.from(await req.arrayBuffer())
    if (body.length === 0) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 })
    }
    if (body.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Try a smaller image." },
        { status: 413 }
      )
    }

    await putObjectBuffer({
      key: image.s3Key,
      body,
      contentType: image.contentType,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[images/upload]", err)
    const message =
      err instanceof Error ? err.message : "Could not upload image"
    const status = message.includes("custom:client_id") ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

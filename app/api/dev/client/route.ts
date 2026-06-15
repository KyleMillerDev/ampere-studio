import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  ACTIVE_CLIENT_COOKIE,
  isDevClientSwitchEnabled,
} from "@/lib/cms/client-context"
import { listClients } from "@/lib/cms/clients"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  client_id: z.string().min(1),
})

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(req: Request) {
  if (!isDevClientSwitchEnabled()) return unavailable()

  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const clients = await listClients()
  const client = clients.find(
    (item) => item.client_id === parsed.data.client_id
  )
  if (!client) {
    return NextResponse.json({ error: "Unknown client" }, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_CLIENT_COOKIE, client.client_id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  return NextResponse.json({ client })
}

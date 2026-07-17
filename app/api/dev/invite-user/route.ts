import { NextResponse } from "next/server"
import { z } from "zod"

import { inviteCognitoUser } from "@/lib/auth/cognito-admin"
import { isAuthConfigured } from "@/lib/auth/amplify-config"
import { isDevClientSwitchEnabled } from "@/lib/cms/client-context"
import { listClients } from "@/lib/cms/clients"
import { resolveLoginUrl, sendInviteEmail } from "@/lib/email/invite-email"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  email: z.string().email(),
  client_id: z.string().min(1),
})

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(req: Request) {
  if (!isDevClientSwitchEnabled()) return unavailable()

  if (!isAuthConfigured) {
    return NextResponse.json(
      { error: "Cognito is not configured. Run setup:cognito first." },
      { status: 503 }
    )
  }

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

  try {
    const invite = await inviteCognitoUser({
      email: parsed.data.email,
      clientId: client.client_id,
    })

    await sendInviteEmail({
      to: invite.email,
      temporaryPassword: invite.temporaryPassword,
      loginUrl: resolveLoginUrl(),
      clientName: client.name,
    })

    return NextResponse.json({
      email: invite.email,
      client_id: invite.clientId,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not invite user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

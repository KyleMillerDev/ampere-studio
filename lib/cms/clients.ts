import { ScanCommand } from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { CLIENTS_TABLE } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"

export interface ClientOption {
  client_id: string
  name: string
  domain?: string
  email?: string
  industry?: string
}

export interface ClientProfile {
  client_id: string
  name: string
  industry: string
}

function stringFrom(
  item: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

function toClientOption(item: Record<string, unknown>): ClientOption | null {
  const clientId = stringFrom(item, ["client_id", "clientId", "id"])
  if (!clientId) return null

  return {
    client_id: clientId,
    name:
      stringFrom(item, [
        "name",
        "client_name",
        "clientName",
        "businessName",
        "companyName",
      ]) ?? clientId,
    domain: stringFrom(item, ["domain", "website", "siteUrl", "url"]),
    email: stringFrom(item, ["email", "recipientEmail", "recipient_email"]),
    industry: stringFrom(item, ["industry", "Industry", "vertical"]),
  }
}

export async function listClients(): Promise<ClientOption[]> {
  const clients: ClientOption[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new ScanCommand({
        TableName: CLIENTS_TABLE,
        ExclusiveStartKey: startKey,
      })
    )

    for (const item of res.Items ?? []) {
      const client = toClientOption(item)
      if (client) clients.push(client)
    }

    startKey = res.LastEvaluatedKey
  } while (startKey)

  return clients.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getActiveClientProfile(): Promise<ClientProfile> {
  const clientId = await getActiveClientId()
  const clients = await listClients()
  const match = clients.find((c) => c.client_id === clientId)
  return {
    client_id: clientId,
    name: match?.name ?? clientId,
    industry: match?.industry ?? "general business",
  }
}

import { cache } from "react"
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { CLIENTS_TABLE } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  parseCatalogProvider,
  parseClientFeatures,
  type CatalogProvider,
  type ClientFeatures,
} from "@/lib/cms/client-features"

export type { CatalogProvider, ClientFeatures }
export { parseCatalogProvider, parseClientFeatures }

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

export interface ClientRecord {
  client_id: string
  name: string
  domain?: string
  email?: string
  industry?: string
  catalog?: unknown
  blog?: unknown
  analytics?: unknown
  site_editor?: unknown
  siteEditor?: unknown
  rentals?: unknown
  submissions?: unknown
  /** Business order-notification recipient. Falls back to `email`. */
  order_email_notif?: string
  /** Path on the client site for order lookup (default: /orders/lookup). */
  order_lookup_path?: string
  /** Brand primary color hex (e.g. "#1a2b3c") for email templates. */
  primary_color?: string
  /** Brand logo URL for email header. */
  logo_url?: string
  [key: string]: unknown
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

function clientNameFrom(
  item: Record<string, unknown>,
  clientId: string
): string {
  return (
    stringFrom(item, [
      "name",
      "client_name",
      "clientName",
      "businessName",
      "companyName",
      "company_name",
    ]) ?? clientId
  )
}

function toClientRecord(item: Record<string, unknown>): ClientRecord | null {
  const clientId = stringFrom(item, ["client_id", "clientId", "id"])
  if (!clientId) return null

  const email = stringFrom(item, [
    "email",
    "recipientEmail",
    "recipient_email",
    "submission_email",
  ])

  return {
    ...item,
    client_id: clientId,
    name: clientNameFrom(item, clientId),
    domain: stringFrom(item, ["domain", "website", "siteUrl", "url"]),
    email,
    industry: stringFrom(item, ["industry", "Industry", "vertical"]),
    order_email_notif:
      stringFrom(item, ["order_email_notif", "order_notif_email"]) ?? email,
    order_lookup_path:
      stringFrom(item, ["order_lookup_path"]) ?? "/orders/lookup",
    primary_color: stringFrom(item, ["primary_color", "primaryColor"]),
    logo_url: stringFrom(item, ["logo_url", "logoUrl"]),
  }
}

function toClientOption(item: Record<string, unknown>): ClientOption | null {
  const record = toClientRecord(item)
  if (!record) return null

  return {
    client_id: record.client_id,
    name: record.name,
    domain: record.domain,
    email: record.email,
    industry: record.industry,
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

export const getClientById = cache(
  async (clientId: string): Promise<ClientRecord | null> => {
    const res = await getDynamo().send(
      new GetCommand({
        TableName: CLIENTS_TABLE,
        Key: { client_id: clientId },
      })
    )

    if (!res.Item) return null
    return toClientRecord(res.Item)
  }
)

export const getActiveClient = cache(async (): Promise<ClientRecord> => {
  const clientId = await getActiveClientId()
  const client = await getClientById(clientId)
  if (client) return client

  return {
    client_id: clientId,
    name: clientId,
    industry: "general business",
  }
})

export const getActiveClientFeatures = cache(
  async (): Promise<ClientFeatures> => {
    const client = await getActiveClient()
    return parseClientFeatures(client)
  }
)

export const getActiveCatalogProvider = cache(
  async (): Promise<CatalogProvider | null> => {
    const client = await getActiveClient()
    return parseCatalogProvider(client.catalog)
  }
)

export async function getActiveClientProfile(): Promise<ClientProfile> {
  const client = await getActiveClient()
  return {
    client_id: client.client_id,
    name: client.name,
    industry: client.industry ?? "general business",
  }
}

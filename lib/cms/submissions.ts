import { QueryCommand } from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { SUBMISSIONS_TABLE } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"

export interface Submission {
  client_id: string
  submissionId: string
  timestamp: string
  formId?: string
  serviceName?: string
  subServiceName?: string
  name?: string
  email?: string
  phone?: string
  message?: string
  fields?: Record<string, unknown>
  status?: "new" | "read" | "archived"
  source?: string
}

function toSubmission(
  item: Record<string, unknown>,
  fallbackClientId: string
): Submission {
  return {
    client_id: String(item.client_id ?? fallbackClientId),
    submissionId: String(item.submissionId ?? ""),
    timestamp: String(item.timestamp ?? ""),
    formId: item.formId ? String(item.formId) : undefined,
    serviceName: item.serviceName ? String(item.serviceName) : undefined,
    subServiceName: item.subServiceName
      ? String(item.subServiceName)
      : undefined,
    name: item.name ? String(item.name) : undefined,
    email: item.email ? String(item.email) : undefined,
    phone: item.phone ? String(item.phone) : undefined,
    message: item.message ? String(item.message) : undefined,
    fields: (item.fields as Record<string, unknown>) ?? undefined,
    status: (item.status as Submission["status"]) ?? "new",
    source: item.source ? String(item.source) : undefined,
  }
}

export async function listSubmissions(params?: {
  limit?: number
}): Promise<Submission[]> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: SUBMISSIONS_TABLE,
      KeyConditionExpression: "client_id = :cid",
      ExpressionAttributeValues: { ":cid": clientId },
      ScanIndexForward: false,
      Limit: params?.limit,
    })
  )
  return (res.Items ?? []).map((item) => toSubmission(item, clientId))
}

export async function countSubmissionsSince(isoDate: string): Promise<number> {
  const clientId = await getActiveClientId()
  const res = await getDynamo().send(
    new QueryCommand({
      TableName: SUBMISSIONS_TABLE,
      KeyConditionExpression: "client_id = :cid AND #ts >= :since",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: {
        ":cid": clientId,
        ":since": isoDate,
      },
      Select: "COUNT",
    })
  )
  return res.Count ?? 0
}

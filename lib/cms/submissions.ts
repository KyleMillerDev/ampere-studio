import {
  DeleteCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { SUBMISSIONS_TABLE } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  type Submission,
  type SubmissionStatus,
} from "@/lib/cms/submission-types"

export type { Submission, SubmissionStatus } from "@/lib/cms/submission-types"
export { isUnreadSubmission } from "@/lib/cms/submission-types"

function nestedData(item: Record<string, unknown>): Record<string, unknown> {
  const data = item.data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return {}
}

function stringField(
  item: Record<string, unknown>,
  data: Record<string, unknown>,
  key: string
): string | undefined {
  const value = item[key] ?? data[key]
  if (value === undefined || value === null || value === "") return undefined
  return String(value)
}

function toSubmission(
  item: Record<string, unknown>,
  fallbackClientId: string
): Submission {
  const data = nestedData(item)
  const standardKeys = new Set(["name", "email", "phone", "message"])
  const extraFields: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (!standardKeys.has(key) && value != null && value !== "") {
      extraFields[key] = value
    }
  }

  const topLevelFields = item.fields as Record<string, unknown> | undefined
  const fields =
    topLevelFields && Object.keys(topLevelFields).length > 0
      ? topLevelFields
      : Object.keys(extraFields).length > 0
        ? extraFields
        : undefined

  return {
    client_id: String(item.client_id ?? fallbackClientId),
    submissionId: String(item.submissionId ?? item.id ?? ""),
    timestamp: String(item.timestamp ?? item.submittedAt ?? ""),
    formId:
      stringField(item, data, "formId") ?? stringField(item, data, "formType"),
    serviceName: stringField(item, data, "serviceName"),
    subServiceName: stringField(item, data, "subServiceName"),
    name: stringField(item, data, "name"),
    email: stringField(item, data, "email"),
    phone: stringField(item, data, "phone"),
    message: stringField(item, data, "message"),
    fields,
    status: (item.status as Submission["status"]) ?? "new",
    source:
      stringField(item, data, "source") ??
      stringField(item, data, "sourcePage"),
  }
}

async function scanSubmissionsForClient(
  clientId: string
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  let startKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new ScanCommand({
        TableName: SUBMISSIONS_TABLE,
        FilterExpression: "client_id = :cid",
        ExpressionAttributeValues: { ":cid": clientId },
        ExclusiveStartKey: startKey,
      })
    )

    for (const item of res.Items ?? []) {
      items.push(item as Record<string, unknown>)
    }

    startKey = res.LastEvaluatedKey
  } while (startKey)

  return items
}

export async function listSubmissions(params?: {
  limit?: number
}): Promise<Submission[]> {
  const clientId = await getActiveClientId()
  const items = await scanSubmissionsForClient(clientId)
  const sorted = items
    .map((item) => toSubmission(item, clientId))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  if (params?.limit) {
    return sorted.slice(0, params.limit)
  }

  return sorted
}

export async function countUnreadSubmissions(): Promise<number> {
  const clientId = await getActiveClientId()
  let count = 0
  let startKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new ScanCommand({
        TableName: SUBMISSIONS_TABLE,
        FilterExpression:
          "client_id = :cid AND (#status = :new OR attribute_not_exists(#status))",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":cid": clientId,
          ":new": "new",
        },
        ExclusiveStartKey: startKey,
        Select: "COUNT",
      })
    )

    count += res.Count ?? 0
    startKey = res.LastEvaluatedKey
  } while (startKey)

  return count
}

export async function updateSubmissionStatus(
  submissionId: string,
  timestamp: string,
  status: SubmissionStatus
): Promise<void> {
  const clientId = await getActiveClientId()
  await getDynamo().send(
    new UpdateCommand({
      TableName: SUBMISSIONS_TABLE,
      Key: { id: submissionId, timestamp },
      UpdateExpression: "SET #status = :status",
      ConditionExpression: "client_id = :cid",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":cid": clientId,
      },
    })
  )
}

export async function bulkUpdateSubmissionStatus(
  items: Array<{ submissionId: string; timestamp: string }>,
  status: SubmissionStatus
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      updateSubmissionStatus(item.submissionId, item.timestamp, status)
    )
  )
}

export async function deleteSubmission(
  submissionId: string,
  timestamp: string
): Promise<void> {
  const clientId = await getActiveClientId()
  await getDynamo().send(
    new DeleteCommand({
      TableName: SUBMISSIONS_TABLE,
      Key: { id: submissionId, timestamp },
      ConditionExpression: "client_id = :cid",
      ExpressionAttributeValues: {
        ":cid": clientId,
      },
    })
  )
}

export async function bulkDeleteSubmissions(
  items: Array<{ submissionId: string; timestamp: string }>
): Promise<void> {
  await Promise.all(
    items.map((item) => deleteSubmission(item.submissionId, item.timestamp))
  )
}

export async function countSubmissionsSince(isoDate: string): Promise<number> {
  const clientId = await getActiveClientId()
  let count = 0
  let startKey: Record<string, unknown> | undefined

  do {
    const res = await getDynamo().send(
      new ScanCommand({
        TableName: SUBMISSIONS_TABLE,
        FilterExpression: "client_id = :cid AND #ts >= :since",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        ExpressionAttributeValues: {
          ":cid": clientId,
          ":since": isoDate,
        },
        ExclusiveStartKey: startKey,
        Select: "COUNT",
      })
    )

    count += res.Count ?? 0
    startKey = res.LastEvaluatedKey
  } while (startKey)

  return count
}

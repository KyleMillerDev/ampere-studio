/**
 * One-time script: copies all option preset (op_*) rows from KMCMS-Content
 * into Ampere-Studio-Content as sqoptpreset_* rows for client_id "neebz".
 *
 * Source format  (KMCMS-Content):
 *   PK: client_id="neebz"  SK: id="op_<uuid>"
 *   type: "item_option_preset"
 *   item_option_preset_data: { type, id, item_option_data: { name, display_name, values[] } }
 *
 * Destination format (Ampere-Studio-Content / SquareOptionPreset):
 *   PK: client_id="neebz"  SK: id="sqoptpreset_<uuid>"
 *   raw_id: "<uuid>"
 *   type: "sqoptpreset"
 *   name: display_name
 *   option: <item_option_preset_data verbatim>
 *   created_at / updated_at
 *
 * Run: npx tsx scripts/copy-option-presets.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb"

const SOURCE_TABLE = "KMCMS-Content"
const DEST_TABLE = "Ampere-Studio-Content"
const CLIENT_ID = "neebz"
const SOURCE_PREFIX = "op_"
const DEST_PREFIX = "sqoptpreset_"

const raw = new DynamoDBClient({ region: "us-east-2" })
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
})

async function main() {
  console.log(
    `Scanning ${SOURCE_TABLE} for ${SOURCE_PREFIX}* items (client_id=${CLIENT_ID})...`
  )

  const sourceItems: Record<string, unknown>[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: SOURCE_TABLE,
        KeyConditionExpression: "client_id = :cid AND begins_with(id, :prefix)",
        ExpressionAttributeValues: {
          ":cid": CLIENT_ID,
          ":prefix": SOURCE_PREFIX,
        },
        ExclusiveStartKey: lastKey,
      })
    )
    sourceItems.push(...(res.Items ?? []))
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey)

  console.log(`Found ${sourceItems.length} source option preset(s).\n`)

  let copied = 0
  let skipped = 0

  for (const src of sourceItems) {
    const srcId = src.id as string // e.g. "op_<uuid>"
    const rawId = srcId.startsWith(SOURCE_PREFIX)
      ? srcId.slice(SOURCE_PREFIX.length)
      : srcId

    const presetData = src.item_option_preset_data as Record<string, unknown>
    const optionData = presetData?.item_option_data as Record<string, unknown>

    // Prefer display_name for the human-readable name
    const name =
      (optionData?.display_name as string | undefined) ||
      (optionData?.name as string | undefined) ||
      rawId

    const destItem = {
      client_id: CLIENT_ID,
      id: `${DEST_PREFIX}${rawId}`,
      raw_id: rawId,
      type: "sqoptpreset",
      name,
      option: presetData,
      created_at:
        (src.created_at as string | undefined) ?? new Date().toISOString(),
      updated_at:
        (src.last_modified_at as string | undefined) ??
        new Date().toISOString(),
    }

    try {
      await ddb.send(
        new PutCommand({
          TableName: DEST_TABLE,
          Item: destItem,
        })
      )
      console.log(`  Copied: ${srcId} → ${destItem.id}  (${name})`)
      copied++
    } catch (err) {
      console.error(`  FAILED ${srcId}:`, err)
      skipped++
    }
  }

  console.log(`\nDone. Copied: ${copied}, Failed: ${skipped}`)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})

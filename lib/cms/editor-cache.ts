import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"

import { getDynamo } from "@/lib/aws/dynamo"
import { CONTENT_TABLE } from "@/lib/cms/constants"
import { getActiveClientId } from "@/lib/cms/client-context"
import type { EditorBlock } from "@/lib/editor/types"

/**
 * Cached parser output for a (repo, ref) pair. Keyed by the current commit
 * SHA so we can tell instantly whether the cache is still accurate.
 *
 * Stored in the main content table so no new DynamoDB table is required.
 */

const SK_PREFIX = "editcache_"

/**
 * Bump this any time the parser changes the shape or semantics of
 * `EditorBlock` entries (e.g., new `type` value, different `targetId`
 * format). Existing cache rows with a mismatched version are treated as
 * a miss and regenerated on the next fetch-repo call.
 */
export const EDITOR_CACHE_SCHEMA_VERSION = 3

export interface EditorCacheEntry {
  id: string
  client_id: string
  owner: string
  name: string
  ref: string
  commitSha: string
  blocks: EditorBlock[]
  files: string[]
  cachedAt: string
  /** Missing on legacy rows; treated as schema version 1. */
  schemaVersion?: number
}

function buildCacheId(owner: string, name: string, ref: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "-")
  return `${SK_PREFIX}${safe(owner)}_${safe(name)}_${safe(ref)}`
}

export async function getEditorCache(params: {
  owner: string
  name: string
  ref: string
}): Promise<EditorCacheEntry | null> {
  try {
    const clientId = await getActiveClientId()
    const res = await getDynamo().send(
      new GetCommand({
        TableName: CONTENT_TABLE,
        Key: {
          client_id: clientId,
          id: buildCacheId(params.owner, params.name, params.ref),
        },
      })
    )
    return (res.Item as EditorCacheEntry | undefined) ?? null
  } catch {
    // A missing table or permission issue should not block the editor;
    // the caller falls back to a full fetch when the cache is unavailable.
    return null
  }
}

export async function putEditorCache(params: {
  owner: string
  name: string
  ref: string
  commitSha: string
  blocks: EditorBlock[]
  files: string[]
}): Promise<EditorCacheEntry> {
  const clientId = await getActiveClientId()
  const entry: EditorCacheEntry = {
    id: buildCacheId(params.owner, params.name, params.ref),
    client_id: clientId,
    owner: params.owner,
    name: params.name,
    ref: params.ref,
    commitSha: params.commitSha,
    blocks: params.blocks,
    files: params.files,
    cachedAt: new Date().toISOString(),
    schemaVersion: EDITOR_CACHE_SCHEMA_VERSION,
  }
  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: entry,
    })
  )
  return entry
}

export async function deleteEditorCache(params: {
  owner: string
  name: string
  ref: string
}): Promise<void> {
  const clientId = await getActiveClientId()
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: {
        client_id: clientId,
        id: buildCacheId(params.owner, params.name, params.ref),
      },
    })
  )
}

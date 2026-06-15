import fs from "node:fs/promises"
import path from "node:path"

import lodashSet from "lodash/set"

import type { EditorWarning } from "@/lib/editor/types"

export interface JsonMutationInput {
  /** Format: `<relative file>:<dot.key.path>`. */
  targetId: string
  newValue: string
}

export interface JsonMutationResult {
  modifiedFiles: Set<string>
  warnings: EditorWarning[]
}

/**
 * Apply JSON-backed content changes in-place on the fetched repo.
 *
 * Every input is expected to use the `<file>:<dot.key.path>` format the
 * scanner records in `EditorBlock.targetId` when `sourceType === 'json'`.
 * Modifications are batched per file so we only read/write each JSON once.
 */
export async function applyJsonMutations(params: {
  repoPath: string
  changes: JsonMutationInput[]
}): Promise<JsonMutationResult> {
  const warnings: EditorWarning[] = []
  const modifiedFiles = new Set<string>()
  const perFile = new Map<string, JsonMutationInput[]>()

  for (const change of params.changes) {
    const parsed = parseTarget(change.targetId)
    if (!parsed) {
      warnings.push({ targetId: change.targetId, reason: "malformed-json-target" })
      continue
    }
    const bucket = perFile.get(parsed.file) ?? []
    bucket.push(change)
    perFile.set(parsed.file, bucket)
  }

  for (const [relFile, changes] of perFile) {
    const absolute = path.join(params.repoPath, relFile)
    let json: unknown
    let raw: string
    try {
      raw = await fs.readFile(absolute, "utf8")
      json = JSON.parse(raw)
    } catch {
      for (const change of changes) {
        warnings.push({
          targetId: change.targetId,
          reason: `could-not-read:${relFile}`,
        })
      }
      continue
    }

    for (const change of changes) {
      const parsed = parseTarget(change.targetId)
      if (!parsed) continue
      if (typeof json !== "object" || json === null) {
        warnings.push({
          targetId: change.targetId,
          reason: "json-root-is-not-object",
        })
        continue
      }
      lodashSet(json as object, parsed.key, change.newValue)
    }

    const indent = detectIndent(raw)
    const trailingNewline = raw.endsWith("\n") ? "\n" : ""
    const serialized = JSON.stringify(json, null, indent) + trailingNewline
    await fs.writeFile(absolute, serialized, "utf8")
    modifiedFiles.add(relFile)
  }

  return { modifiedFiles, warnings }
}

function parseTarget(value: string): { file: string; key: string } | null {
  const colon = value.indexOf(":")
  if (colon < 1 || colon === value.length - 1) return null
  const file = value.slice(0, colon).trim()
  const key = value.slice(colon + 1).trim()
  if (!file.toLowerCase().endsWith(".json")) return null
  return { file, key }
}

function detectIndent(raw: string): number | string {
  const match = raw.match(/\n(\s+)\S/)
  if (!match) return 2
  const leading = match[1]
  if (leading.includes("\t")) return "\t"
  return leading.length
}

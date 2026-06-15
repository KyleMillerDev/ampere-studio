import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

import { EDITOR_SESSION_TTL_MS } from "@/lib/cms/constants"
import type { EditorBlock } from "@/lib/editor/types"

/**
 * Extraction status for the on-disk copy of the repo. Publish-time mutations
 * need the repo extracted locally, but read-only block data can be served
 * from the DynamoDB cache without waiting for the extract to finish.
 */
export type ExtractionStatus = "pending" | "extracting" | "ready" | "failed"

export interface ExtractionState {
  status: ExtractionStatus
  /** Populated when status === "failed". */
  error?: string
  /** Resolves (or rejects) when extraction finishes. */
  promise?: Promise<void>
}

export interface EditorSession {
  sessionId: string
  /** Null until extraction completes. Publish waits on extraction.promise. */
  repoPath: string | null
  owner: string
  name: string
  ref: string
  /** Commit SHA this session is pinned to (if known). */
  commitSha?: string
  /** Optional deployed site URL used for the proxied live preview. */
  siteUrl?: string
  /** Server-side GitHub token from env; it is never sent back to the browser. */
  pat: string
  blocks: EditorBlock[]
  files: string[]
  extraction: ExtractionState
  createdAt: number
  expiresAt: number
}

/**
 * In-memory session store. Module-level map that survives across requests
 * in the same Next.js server process.
 */
const sessions = new Map<string, EditorSession>()

export function getSession(id: string): EditorSession | null {
  const s = sessions.get(id)
  if (!s) return null
  if (Date.now() > s.expiresAt) {
    // Fire-and-forget cleanup so stale directories do not accumulate.
    void destroySession(id)
    return null
  }
  return s
}

export function putSession(session: EditorSession): void {
  sessions.set(session.sessionId, session)
}

export async function destroySession(id: string): Promise<void> {
  const s = sessions.get(id)
  sessions.delete(id)
  if (s && s.repoPath) {
    try {
      await fs.rm(s.repoPath, { recursive: true, force: true })
    } catch {
      // Best-effort cleanup.
    }
  }
}

export function sessionPublicView(s: EditorSession): {
  sessionId: string
  owner: string
  name: string
  ref: string
  siteUrl?: string
  blocks: EditorBlock[]
  commitSha?: string
  extractionStatus: ExtractionStatus
  expiresAt: number
} {
  return {
    sessionId: s.sessionId,
    owner: s.owner,
    name: s.name,
    ref: s.ref,
    siteUrl: s.siteUrl,
    blocks: s.blocks,
    commitSha: s.commitSha,
    extractionStatus: s.extraction.status,
    expiresAt: s.expiresAt,
  }
}

/** Root directory where all editor sessions are extracted. */
export function getSessionsRoot(): string {
  return path.join(os.tmpdir(), "ampere-studio-sessions")
}

export async function ensureSessionsRoot(): Promise<string> {
  const root = getSessionsRoot()
  await fs.mkdir(root, { recursive: true })
  return root
}

/** Sweep anything older than TTL on startup (best-effort). */
export async function sweepExpiredSessions(): Promise<void> {
  const root = getSessionsRoot()
  let entries: string[] = []
  try {
    entries = await fs.readdir(root)
  } catch {
    return
  }
  const now = Date.now()
  for (const entry of entries) {
    const dir = path.join(root, entry)
    try {
      const stat = await fs.stat(dir)
      if (now - stat.mtimeMs > EDITOR_SESSION_TTL_MS) {
        await fs.rm(dir, { recursive: true, force: true })
      }
    } catch {
      // Ignore.
    }
  }
}

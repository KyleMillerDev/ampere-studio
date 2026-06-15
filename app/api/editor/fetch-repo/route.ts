import path from "node:path"

import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

import { EDITOR_SESSION_TTL_MS } from "@/lib/cms/constants"
import {
  EDITOR_CACHE_SCHEMA_VERSION,
  getEditorCache,
  putEditorCache,
} from "@/lib/cms/editor-cache"
import { getEditorRepoConfig } from "@/lib/editor/config"
import {
  downloadZipball,
  getHeadSha,
  octokitWithPat,
} from "@/lib/editor/github"
import { extractZipball } from "@/lib/editor/zip"
import { scanRepo } from "@/lib/editor/parse"
import {
  destroySession,
  ensureSessionsRoot,
  putSession,
  sessionPublicView,
  type EditorSession,
} from "@/lib/editor/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 180

/**
 * Cache-aware editor session bootstrap.
 *
 * Flow:
 *   1. Validate env config + resolve HEAD SHA and DynamoDB cache in parallel.
 *   2. If the cache exists and its commit SHA matches HEAD, return blocks
 *      immediately. Kick off a background zip extract so Publish stays fast.
 *   3. Otherwise run the full zip + extract + scan path, persist the result
 *      to the cache, and mark the session ready.
 */
export async function POST(req: Request) {
  await req.json().catch(() => ({}))

  const repoConfig = getEditorRepoConfig()
  if (!repoConfig.ok) {
    return NextResponse.json({ error: repoConfig.error }, { status: 500 })
  }

  const { token, owner, name, ref, siteUrl } = repoConfig.config
  const octokit = octokitWithPat(token)

  let headSha: string
  try {
    headSha = await getHeadSha({ octokit, owner, repo: name, ref })
  } catch (err) {
    return mapGithubError(err)
  }

  const cached = await getEditorCache({ owner, name, ref })
  const sessionId = uuidv4()
  const now = Date.now()

  const cachedSchemaVersion = cached?.schemaVersion ?? 1
  const cacheIsFresh =
    cached != null &&
    cached.commitSha === headSha &&
    cachedSchemaVersion === EDITOR_CACHE_SCHEMA_VERSION

  if (cacheIsFresh && cached) {
    // Fast path: cache is up-to-date. Return blocks immediately and start
    // extracting the repo on disk so the publish flow is ready when needed.
    const session: EditorSession = {
      sessionId,
      repoPath: null,
      owner,
      name,
      ref,
      commitSha: headSha,
      siteUrl,
      pat: token,
      blocks: cached.blocks,
      files: cached.files,
      extraction: { status: "pending" },
      createdAt: now,
      expiresAt: now + EDITOR_SESSION_TTL_MS,
    }
    putSession(session)

    void startBackgroundExtraction({ session, token })

    return NextResponse.json({
      session: sessionPublicView(session),
      warnings: [],
      counts: {
        blocks: cached.blocks.length,
        files: cached.files.length,
      },
      fromCache: true,
      commitSha: headSha,
      cachedAt: cached.cachedAt,
    })
  }

  // Slow path: cache miss or stale. Download + extract + scan synchronously.
  const sessionsRoot = await ensureSessionsRoot()
  const extractRoot = path.join(sessionsRoot, sessionId)

  let zipBuffer: Buffer
  try {
    zipBuffer = await downloadZipball({
      octokit,
      owner,
      repo: name,
      ref: headSha,
    })
  } catch (err) {
    return mapGithubError(err)
  }

  const repoPath = await extractZipball({
    buffer: zipBuffer,
    destination: extractRoot,
  })

  let scanned
  try {
    scanned = await scanRepo(repoPath)
  } catch (err) {
    await destroySession(sessionId)
    return NextResponse.json(
      {
        error: "Parsing the repository failed. Is it a valid Next.js project?",
        detail: (err as Error).message,
      },
      { status: 422 }
    )
  }

  const session: EditorSession = {
    sessionId,
    repoPath,
    owner,
    name,
    ref,
    commitSha: headSha,
    siteUrl,
    pat: token,
    blocks: scanned.blocks,
    files: scanned.files,
    extraction: { status: "ready" },
    createdAt: now,
    expiresAt: now + EDITOR_SESSION_TTL_MS,
  }
  putSession(session)

  // Persist to cache. Fire-and-forget so we do not delay the response.
  void putEditorCache({
    owner,
    name,
    ref,
    commitSha: headSha,
    blocks: scanned.blocks,
    files: scanned.files,
  }).catch(() => {
    // Swallow cache persistence errors; the user already has a working session.
  })

  return NextResponse.json({
    session: sessionPublicView(session),
    warnings: scanned.warnings,
    counts: {
      blocks: scanned.blocks.length,
      files: scanned.files.length,
    },
    fromCache: false,
    commitSha: headSha,
  })
}

/**
 * Download + extract the repo on disk in the background. Updates the
 * session's `extraction` state so the publish route can wait on it.
 *
 * We also persist the session with the fresh `repoPath` so future lookups
 * via `getSession` see the extracted copy without an extra put.
 */
function startBackgroundExtraction(params: {
  session: EditorSession
  token: string
}): Promise<void> {
  const { session, token } = params
  session.extraction = { status: "extracting" }
  const octokit = octokitWithPat(token)

  const promise = (async () => {
    try {
      const sessionsRoot = await ensureSessionsRoot()
      const extractRoot = path.join(sessionsRoot, session.sessionId)
      const zipBuffer = await downloadZipball({
        octokit,
        owner: session.owner,
        repo: session.name,
        ref: session.commitSha ?? session.ref,
      })
      const repoPath = await extractZipball({
        buffer: zipBuffer,
        destination: extractRoot,
      })
      session.repoPath = repoPath
      session.extraction = { status: "ready" }
    } catch (err) {
      session.extraction = {
        status: "failed",
        error:
          err instanceof Error
            ? err.message
            : "Background repo extraction failed.",
      }
    }
  })()

  session.extraction.promise = promise
  return promise
}

function mapGithubError(err: unknown): NextResponse {
  const status =
    (err as { status?: number })?.status ??
    (err as { response?: { status?: number } })?.response?.status

  if (status === 404) {
    return NextResponse.json(
      {
        error:
          "Configured repo or ref was not found. Check AMPERE_DEFAULT_REPO, AMPERE_DEFAULT_REF, and token access.",
      },
      { status: 404 }
    )
  }
  if (status === 401 || status === 403) {
    return NextResponse.json(
      {
        error:
          "GitHub rejected AMPERE_GITHUB_TOKEN. Grant it access to the configured repository.",
      },
      { status: 401 }
    )
  }
  return NextResponse.json(
    {
      error: "Could not reach GitHub.",
      detail: (err as Error).message,
    },
    { status: 502 }
  )
}

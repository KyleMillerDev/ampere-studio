import { NextResponse } from "next/server"
import { z } from "zod"

import { PUBLISH_BRANCH } from "@/lib/cms/constants"
import { octokitWithPat } from "@/lib/editor/github"
import { applyJsonMutations } from "@/lib/editor/json-mutate"
import { applyInlineMutations } from "@/lib/editor/mutate"
import { commitUpdatesToBranch } from "@/lib/editor/git-commit"
import { getSession } from "@/lib/editor/session"
import type { EditorChange, EditorWarning } from "@/lib/editor/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

const changeSchema = z.object({
  blockId: z.string().min(1),
  targetId: z.string().min(1),
  sourceType: z.enum(["inline", "json"]),
  type: z.enum(["text", "image"]),
  newValue: z.string(),
})

const bodySchema = z.object({
  sessionId: z.string().min(1),
  changes: z.array(changeSchema).min(1),
})

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const session = getSession(parsed.data.sessionId)
  if (!session) {
    return NextResponse.json(
      { error: "Editor session not found or expired. Reconnect the repo." },
      { status: 404 }
    )
  }

  // If the repo is still being extracted in the background (cache-hit path),
  // wait for it before we try to mutate files on disk.
  if (session.extraction.status !== "ready") {
    if (session.extraction.promise) {
      try {
        await session.extraction.promise
      } catch {
        // fall through to the status check below
      }
    }
  }

  if (session.extraction.status !== "ready" || !session.repoPath) {
    return NextResponse.json(
      {
        error:
          session.extraction.error ??
          "Repository extraction is still in progress. Try again in a moment.",
      },
      { status: 503 }
    )
  }

  const repoPath = session.repoPath
  const allChanges: EditorChange[] = parsed.data.changes
  const inlineChanges = allChanges.filter((c) => c.sourceType === "inline")
  const jsonChanges = allChanges.filter((c) => c.sourceType === "json")

  const warnings: EditorWarning[] = []
  const modifiedFiles = new Set<string>()

  // 1. Apply JSON mutations on disk.
  if (jsonChanges.length > 0) {
    const result = await applyJsonMutations({
      repoPath,
      changes: jsonChanges.map((c) => ({
        targetId: c.targetId,
        newValue: c.newValue,
      })),
    })
    result.modifiedFiles.forEach((f) => modifiedFiles.add(f))
    warnings.push(...result.warnings)
  }

  // 2. Apply inline JSX mutations on disk via ts-morph.
  if (inlineChanges.length > 0) {
    const result = await applyInlineMutations({
      repoPath,
      changes: inlineChanges,
    })
    result.modifiedFiles.forEach((f) => modifiedFiles.add(f))
    warnings.push(...result.warnings)
  }

  if (modifiedFiles.size === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No files changed. See warnings for why the changes were skipped.",
        warnings,
      },
      { status: 422 }
    )
  }

  // 3. Commit and push to the review branch.
  const octokit = octokitWithPat(session.pat)
  try {
    const commitResult = await commitUpdatesToBranch({
      octokit,
      owner: session.owner,
      repo: session.name,
      baseRef: session.ref,
      targetBranch: PUBLISH_BRANCH,
      repoPath,
      modifiedFiles: Array.from(modifiedFiles),
      message: buildCommitMessage(allChanges.length),
    })

    return NextResponse.json({
      ok: true,
      branch: commitResult.branch,
      commitUrl: commitResult.commitUrl,
      commitSha: commitResult.commitSha,
      modifiedFiles: Array.from(modifiedFiles),
      warnings,
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "GitHub rejected the publish. The PAT may lack write access to the repo.",
          warnings,
        },
        { status: 401 }
      )
    }
    throw err
  }
}

function buildCommitMessage(count: number): string {
  const noun = count === 1 ? "change" : "changes"
  return `Ampere Studio content update (${count} ${noun})\n\nPublished via the Ampere Studio visual editor.`
}

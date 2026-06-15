import fs from "node:fs/promises"
import path from "node:path"

import type { Octokit } from "@octokit/rest"

export interface CommitParams {
  octokit: Octokit
  owner: string
  repo: string
  /** Source branch to branch off of when the review branch does not exist yet. */
  baseRef: string
  /** Branch that receives the commit. Created if missing, extended if present. */
  targetBranch: string
  /** Absolute path to the extracted repo on disk. */
  repoPath: string
  /** Repo-relative paths of every file we modified. */
  modifiedFiles: string[]
  message: string
}

export interface CommitResult {
  commitSha: string
  commitUrl: string
  branch: string
}

/**
 * Create a GitHub commit on `targetBranch` that updates every file in
 * `modifiedFiles`. Uses the git data API to avoid touching the working copy
 * on disk twice.
 */
export async function commitUpdatesToBranch(
  params: CommitParams
): Promise<CommitResult> {
  const { octokit, owner, repo, targetBranch, repoPath, modifiedFiles } = params

  // Resolve the base commit SHA of the source branch/tag/commit.
  const baseCommit = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: params.baseRef,
  })
  const baseSha = baseCommit.data.sha

  // Does the target branch already exist? If so, stack the next commit on top of its tip.
  let parentSha = baseSha
  let branchExists = false
  try {
    const existing = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${targetBranch}`,
    })
    parentSha = existing.data.object.sha
    branchExists = true
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status !== 404) throw err
  }

  // Create blobs for every modified file.
  const treeItems: Array<{
    path: string
    mode: "100644"
    type: "blob"
    sha: string
  }> = []

  for (const relative of modifiedFiles) {
    const absolute = path.join(repoPath, relative)
    const content = await fs.readFile(absolute)
    const blob = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: content.toString("base64"),
      encoding: "base64",
    })
    treeItems.push({
      path: relative,
      mode: "100644",
      type: "blob",
      sha: blob.data.sha,
    })
  }

  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: parentSha,
    tree: treeItems,
  })

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: params.message,
    tree: tree.data.sha,
    parents: [parentSha],
  })

  if (branchExists) {
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${targetBranch}`,
      sha: commit.data.sha,
      force: false,
    })
  } else {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${targetBranch}`,
      sha: commit.data.sha,
    })
  }

  return {
    commitSha: commit.data.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commit.data.sha}`,
    branch: targetBranch,
  }
}

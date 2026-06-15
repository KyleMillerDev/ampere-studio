import { Octokit } from "@octokit/rest"

export interface GithubRepoRef {
  owner: string
  name: string
  ref?: string
}

export function parseRepoSlug(slug: string): GithubRepoRef | null {
  const trimmed = slug.trim().replace(/\.git$/i, "")
  const match = trimmed.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/)
  if (!match) return null
  return { owner: match[1], name: match[2] }
}

export function octokitWithPat(pat: string): Octokit {
  return new Octokit({
    auth: pat,
    userAgent: "ampere-studio-cms",
  })
}

/**
 * Download the repository as a zipball into a Buffer.
 *
 * Uses Octokit so we get authenticated access and consistent error shapes.
 * The archive endpoint returns a 302 redirect that Octokit follows transparently.
 */
export async function downloadZipball(params: {
  octokit: Octokit
  owner: string
  repo: string
  ref: string
}): Promise<Buffer> {
  const res = await params.octokit.rest.repos.downloadZipballArchive({
    owner: params.owner,
    repo: params.repo,
    ref: params.ref,
  })
  const raw = res.data as ArrayBuffer | Buffer | Uint8Array
  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof ArrayBuffer) return Buffer.from(raw)
  return Buffer.from(raw as Uint8Array)
}

/** Verify the PAT has access to the repo and the ref exists. */
export async function verifyRepoAccess(params: {
  octokit: Octokit
  owner: string
  repo: string
  ref: string
}): Promise<{ defaultBranch: string; ref: string }> {
  const repo = await params.octokit.rest.repos.get({
    owner: params.owner,
    repo: params.repo,
  })
  const defaultBranch = repo.data.default_branch

  // Validate ref by attempting to fetch its commit.
  await params.octokit.rest.repos.getCommit({
    owner: params.owner,
    repo: params.repo,
    ref: params.ref,
  })

  return { defaultBranch, ref: params.ref }
}

/**
 * Resolve the commit SHA at the tip of `ref`. Small, fast call that also
 * verifies the PAT has access.
 */
export async function getHeadSha(params: {
  octokit: Octokit
  owner: string
  repo: string
  ref: string
}): Promise<string> {
  const res = await params.octokit.rest.repos.getCommit({
    owner: params.owner,
    repo: params.repo,
    ref: params.ref,
  })
  return res.data.sha
}

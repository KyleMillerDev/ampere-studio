import { parseRepoSlug } from "@/lib/editor/github"

export interface EditorRepoConfig {
  token: string
  repo: string
  owner: string
  name: string
  ref: string
  siteUrl?: string
}

/**
 * Server-only editor repo configuration.
 *
 * MVP assumption: Ampere owns/manages the GitHub token and hardcodes the
 * client repo in env until Cognito client metadata is added.
 */
export function getEditorRepoConfig(): {
  ok: true
  config: EditorRepoConfig
} | {
  ok: false
  error: string
} {
  const token = process.env.AMPERE_GITHUB_TOKEN?.trim()
  const repo = process.env.AMPERE_DEFAULT_REPO?.trim()
  const ref = process.env.AMPERE_DEFAULT_REF?.trim() || "main"
  const siteUrl = normalizeSiteUrl(process.env.AMPERE_DEFAULT_SITE_URL)

  if (!token) {
    return {
      ok: false,
      error: "Missing AMPERE_GITHUB_TOKEN in .env.local.",
    }
  }

  if (!repo) {
    return {
      ok: false,
      error: "Missing AMPERE_DEFAULT_REPO in .env.local.",
    }
  }

  const parsed = parseRepoSlug(repo)
  if (!parsed) {
    return {
      ok: false,
      error: "AMPERE_DEFAULT_REPO must look like 'owner/name'.",
    }
  }

  return {
    ok: true,
    config: {
      token,
      repo,
      owner: parsed.owner,
      name: parsed.name,
      ref,
      siteUrl,
    },
  }
}

function normalizeSiteUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined
    url.hash = ""
    url.search = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return undefined
  }
}

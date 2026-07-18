import { beforeEach, describe, expect, it, vi } from "vitest"

import { validatePostHogAccess } from "@/lib/posthog/validate"
import type { PostHogCredentials } from "@/lib/posthog/config"

const credentials: PostHogCredentials = {
  clientId: "cabfresh",
  apiKey: "phx_testkeyfortests123",
  projectId: "517539",
  host: "https://us.posthog.com",
}

describe("PostHog access error mapping", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("maps 401 to invalid_credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: "Invalid API key." }),
      })
    )

    const result = await validatePostHogAccess(credentials)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("invalid_credentials")
      expect(result.message).not.toContain("phx_")
    }
  })

  it("maps 403 scope failures to insufficient_scope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({ detail: "Missing permission query:read" }),
      })
    )

    const result = await validatePostHogAccess(credentials)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("insufficient_scope")
    }
  })

  it("maps 429 to rate_limited and network errors to query_failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "slow down",
      })
    )
    const limited = await validatePostHogAccess(credentials)
    expect(limited.ok).toBe(false)
    if (!limited.ok) expect(limited.code).toBe("rate_limited")

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("socket hang up"))
    )
    const failed = await validatePostHogAccess(credentials)
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.code).toBe("query_failed")
  })

  it("returns ok with sample on successful SELECT 1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ results: [[1]] }),
      })
    )

    const result = await validatePostHogAccess(credentials)
    expect(result).toEqual({
      ok: true,
      credentials,
      sample: 1,
    })
  })
})

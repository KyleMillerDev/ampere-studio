import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/aws/secrets", () => ({
  getClientKeysSecret: vi.fn(),
}))

vi.mock("@/lib/cms/client-context", () => ({
  getActiveClientId: vi.fn(),
}))

import { getClientKeysSecret } from "@/lib/aws/secrets"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  CABFRESH_POSTHOG_PROJECT_ID,
  describePostHogCredentials,
  getPostHogCredentials,
  resolvePostHogConfig,
  toAnalyticsConnectionState,
} from "@/lib/posthog/config"

const getSecret = vi.mocked(getClientKeysSecret)
const getClientId = vi.mocked(getActiveClientId)

describe("PostHog secret lookup and fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getClientId.mockResolvedValue("cabfresh")
  })

  it("returns null when personal key is missing (coming-soon gate)", async () => {
    getSecret.mockResolvedValue({
      cabfresh_posthog_project_id: CABFRESH_POSTHOG_PROJECT_ID,
    })

    await expect(getPostHogCredentials("cabfresh")).resolves.toBeNull()
    await expect(resolvePostHogConfig("cabfresh")).resolves.toEqual({
      status: "missing",
      clientId: "cabfresh",
    })
  })

  it("falls back to active client id when none is passed", async () => {
    getClientId.mockResolvedValue("acme")
    getSecret.mockResolvedValue({})

    await expect(resolvePostHogConfig()).resolves.toEqual({
      status: "missing",
      clientId: "acme",
    })
    expect(getClientId).toHaveBeenCalledOnce()
  })

  it("rejects malformed keys and non-numeric project ids", async () => {
    getSecret.mockResolvedValue({
      cabfresh_posthog_key: "sk_wrong_shape",
      cabfresh_posthog_project_id: CABFRESH_POSTHOG_PROJECT_ID,
    })
    await expect(resolvePostHogConfig("cabfresh")).resolves.toMatchObject({
      status: "invalid",
      code: "invalid_credentials",
    })

    getSecret.mockResolvedValue({
      cabfresh_posthog_key: "phx_validlookingkey123",
      cabfresh_posthog_project_id: "not-a-number",
    })
    await expect(resolvePostHogConfig("cabfresh")).resolves.toMatchObject({
      status: "invalid",
      code: "invalid_credentials",
    })
  })

  it("resolves ok credentials and never exposes the key in connection state", async () => {
    const apiKey = "phx_supersecretpersonalkey"
    getSecret.mockResolvedValue({
      cabfresh_posthog_key: apiKey,
      cabfresh_posthog_project_id: CABFRESH_POSTHOG_PROJECT_ID,
    })

    const resolution = await resolvePostHogConfig("cabfresh")
    expect(resolution).toMatchObject({
      status: "ok",
      credentials: {
        clientId: "cabfresh",
        projectId: CABFRESH_POSTHOG_PROJECT_ID,
        apiKey,
        host: "https://us.posthog.com",
      },
    })

    const connection = toAnalyticsConnectionState(resolution)
    expect(connection).toEqual({
      state: "ready",
      projectId: CABFRESH_POSTHOG_PROJECT_ID,
    })
    expect(JSON.stringify(connection)).not.toContain(apiKey)
    expect(JSON.stringify(connection)).not.toContain("phx_")

    if (resolution.status === "ok") {
      const described = describePostHogCredentials(resolution.credentials)
      expect(described).not.toContain(apiKey)
      expect(described).toContain("phx_")
      expect(described).toContain("…")
    }
  })
})

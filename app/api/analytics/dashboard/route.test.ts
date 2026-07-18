import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/user-client", () => ({
  getAuthenticatedUserContext: vi.fn(),
}))

vi.mock("@/lib/cms/client-context", () => ({
  getActiveClientId: vi.fn(),
}))

vi.mock("@/lib/posthog/validate", () => ({
  resolveAndValidatePostHogAccess: vi.fn(),
}))

vi.mock("@/lib/posthog/query", () => ({
  fetchAnalyticsDashboard: vi.fn(),
}))

import { getAuthenticatedUserContext } from "@/lib/auth/user-client"
import { getActiveClientId } from "@/lib/cms/client-context"
import { resolveAndValidatePostHogAccess } from "@/lib/posthog/validate"
import { fetchAnalyticsDashboard } from "@/lib/posthog/query"
import { POST } from "@/app/api/analytics/dashboard/route"

const getUser = vi.mocked(getAuthenticatedUserContext)
const getClientId = vi.mocked(getActiveClientId)
const resolveAccess = vi.mocked(resolveAndValidatePostHogAccess)
const fetchDashboard = vi.mocked(fetchAnalyticsDashboard)

const validBody = {
  widgetIds: ["visitors"],
  filters: {
    dateRange: { from: "2026-06-01", to: "2026-06-30" },
    comparisonRange: null,
    granularity: "day",
    clauses: [],
  },
}

describe("analytics dashboard auth isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires sign-in before touching PostHog", async () => {
    getUser.mockResolvedValue(null)
    const res = await POST(
      new Request("http://localhost/api/analytics/dashboard", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    )
    expect(res.status).toBe(401)
    expect(resolveAccess).not.toHaveBeenCalled()
    expect(fetchDashboard).not.toHaveBeenCalled()
  })

  it("uses the active CMS client id for credential resolution", async () => {
    getUser.mockResolvedValue({
      cognitoSub: "sub-abc",
      clientId: "ampere",
    })
    getClientId.mockResolvedValue("cabfresh")
    resolveAccess.mockResolvedValue({
      ok: true,
      credentials: {
        clientId: "cabfresh",
        apiKey: "phx_should_not_leave_server",
        projectId: "517539",
        host: "https://us.posthog.com",
      },
      sample: 1,
    })
    fetchDashboard.mockResolvedValue({
      filters: validBody.filters as never,
      results: {},
      fetchedAt: "2026-07-17T00:00:00.000Z",
    })

    const res = await POST(
      new Request("http://localhost/api/analytics/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    )

    expect(res.status).toBe(200)
    expect(resolveAccess).toHaveBeenCalledWith("cabfresh")
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain("phx_")
    expect(JSON.stringify(body)).not.toContain("phx_should_not_leave_server")
  })
})

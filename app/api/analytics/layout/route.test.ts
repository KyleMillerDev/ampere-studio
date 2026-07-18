import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/user-client", () => ({
  getAuthenticatedUserContext: vi.fn(),
}))

vi.mock("@/lib/cms/client-context", () => ({
  getActiveClientId: vi.fn(),
}))

vi.mock("@/lib/cms/analytics-layouts", () => ({
  getAnalyticsLayout: vi.fn(),
  putAnalyticsLayout: vi.fn(),
  deleteAnalyticsLayout: vi.fn(),
}))

import { getAuthenticatedUserContext } from "@/lib/auth/user-client"
import { getActiveClientId } from "@/lib/cms/client-context"
import {
  deleteAnalyticsLayout,
  getAnalyticsLayout,
  putAnalyticsLayout,
} from "@/lib/cms/analytics-layouts"
import { DELETE, GET, PUT } from "@/app/api/analytics/layout/route"
import {
  ANALYTICS_LAYOUT_VERSION,
  type AnalyticsLayoutDocument,
  type AnalyticsWidgetId,
} from "@/lib/analytics/types"

const getUser = vi.mocked(getAuthenticatedUserContext)
const getClientId = vi.mocked(getActiveClientId)
const getLayout = vi.mocked(getAnalyticsLayout)
const putLayout = vi.mocked(putAnalyticsLayout)
const delLayout = vi.mocked(deleteAnalyticsLayout)

describe("analytics layout auth isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects unauthenticated GET/PUT/DELETE", async () => {
    getUser.mockResolvedValue(null)

    const getRes = await GET()
    expect(getRes.status).toBe(401)
    await expect(getRes.json()).resolves.toMatchObject({ code: "unauthorized" })
    expect(getLayout).not.toHaveBeenCalled()

    const putRes = await PUT(
      new Request("http://localhost/api/analytics/layout", {
        method: "PUT",
        body: JSON.stringify({}),
      })
    )
    expect(putRes.status).toBe(401)
    expect(putLayout).not.toHaveBeenCalled()

    const delRes = await DELETE()
    expect(delRes.status).toBe(401)
    expect(delLayout).not.toHaveBeenCalled()
  })

  it("scopes layout reads and writes to active client + cognito sub", async () => {
    getUser.mockResolvedValue({
      cognitoSub: "sub-abc",
      clientId: "ampere",
    })
    getClientId.mockResolvedValue("cabfresh")
    getLayout.mockResolvedValue({
      version: ANALYTICS_LAYOUT_VERSION,
      clientId: "cabfresh",
      cognitoSub: "sub-abc",
      widgetIds: ["visitors"],
      layouts: {
        lg: [{ i: "visitors", x: 0, y: 0, w: 4, h: 2 }],
        md: [{ i: "visitors", x: 0, y: 0, w: 4, h: 2 }],
        sm: [{ i: "visitors", x: 0, y: 0, w: 12, h: 3 }],
      },
      updatedAt: "2026-07-17T00:00:00.000Z",
    })

    const getRes = await GET()
    expect(getRes.status).toBe(200)
    expect(getLayout).toHaveBeenCalledWith("cabfresh", "sub-abc")

    const widgetIds: AnalyticsWidgetId[] = ["visitors", "pageviews"]
    const payload = {
      version: ANALYTICS_LAYOUT_VERSION,
      widgetIds,
      layouts: {
        lg: [
          { i: "visitors" as const, x: 0, y: 0, w: 4, h: 2 },
          { i: "pageviews" as const, x: 4, y: 0, w: 4, h: 2 },
        ],
        md: [
          { i: "visitors" as const, x: 0, y: 0, w: 4, h: 2 },
          { i: "pageviews" as const, x: 4, y: 0, w: 4, h: 2 },
        ],
        sm: [
          { i: "visitors" as const, x: 0, y: 0, w: 12, h: 3 },
          { i: "pageviews" as const, x: 0, y: 3, w: 12, h: 3 },
        ],
      },
    }
    const saved: AnalyticsLayoutDocument = {
      ...payload,
      clientId: "cabfresh",
      cognitoSub: "sub-abc",
      updatedAt: "2026-07-17T01:00:00.000Z",
    }
    putLayout.mockResolvedValue(saved)

    const putRes = await PUT(
      new Request("http://localhost/api/analytics/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    )
    expect(putRes.status).toBe(200)
    expect(putLayout).toHaveBeenCalledWith("cabfresh", "sub-abc", payload)
  })
})

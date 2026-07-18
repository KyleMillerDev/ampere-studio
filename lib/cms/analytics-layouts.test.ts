import { beforeEach, describe, expect, it, vi } from "vitest"

const send = vi.fn()

vi.mock("@/lib/aws/dynamo", () => ({
  getDynamo: () => ({ send }),
}))

import {
  analyticsLayoutId,
  buildDefaultAnalyticsLayout,
  deleteAnalyticsLayout,
  getAnalyticsLayout,
} from "@/lib/cms/analytics-layouts"
import {
  ANALYTICS_LAYOUT_VERSION,
  DEFAULT_WIDGET_IDS,
} from "@/lib/analytics/types"

describe("analytics layout migration and reset", () => {
  beforeEach(() => {
    send.mockReset()
  })

  it("builds the six-widget default layout", () => {
    const layout = buildDefaultAnalyticsLayout("cabfresh", "user-1")
    expect(layout.version).toBe(ANALYTICS_LAYOUT_VERSION)
    expect(layout.widgetIds).toEqual([...DEFAULT_WIDGET_IDS])
    expect(layout.layouts.lg).toHaveLength(6)
    expect(layout.layouts.sm.every((cell) => cell.w === 12)).toBe(true)
    expect(analyticsLayoutId("user-1")).toBe("analayout_user-1")
  })

  it("returns default when no saved layout exists", async () => {
    send.mockResolvedValueOnce({ Item: undefined })
    const layout = await getAnalyticsLayout("cabfresh", "user-1")
    expect(layout.widgetIds).toEqual([...DEFAULT_WIDGET_IDS])
    expect(layout.clientId).toBe("cabfresh")
    expect(layout.cognitoSub).toBe("user-1")
  })

  it("ignores unknown widget ids during migration", async () => {
    send.mockResolvedValueOnce({
      Item: {
        client_id: "cabfresh",
        id: "analayout_user-1",
        version: ANALYTICS_LAYOUT_VERSION,
        clientId: "cabfresh",
        cognitoSub: "user-1",
        widgetIds: ["visitors", "legacy_widget_gone", "pageviews"],
        layouts: {
          lg: [
            { i: "visitors", x: 0, y: 0, w: 4, h: 2 },
            { i: "legacy_widget_gone", x: 4, y: 0, w: 4, h: 2 },
            { i: "pageviews", x: 8, y: 0, w: 4, h: 2 },
          ],
          md: [],
          sm: [],
        },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    })

    const layout = await getAnalyticsLayout("cabfresh", "user-1")
    expect(layout.widgetIds).toEqual(["visitors", "pageviews"])
    expect(layout.layouts.lg.map((cell) => cell.i)).toEqual([
      "visitors",
      "pageviews",
    ])
  })

  it("falls back to default when stored document is unusable", async () => {
    send.mockResolvedValueOnce({
      Item: {
        client_id: "cabfresh",
        id: "analayout_user-1",
        version: ANALYTICS_LAYOUT_VERSION,
        widgetIds: [],
        layouts: { lg: "bad", md: null, sm: 1 },
        updatedAt: "nope",
      },
    })

    const layout = await getAnalyticsLayout("cabfresh", "user-1")
    expect(layout.widgetIds).toEqual([...DEFAULT_WIDGET_IDS])
  })

  it("delete resets to the six-widget default", async () => {
    send.mockResolvedValueOnce({})
    const layout = await deleteAnalyticsLayout("cabfresh", "user-1")
    expect(send).toHaveBeenCalledOnce()
    expect(layout.widgetIds).toEqual([...DEFAULT_WIDGET_IDS])
    expect(layout.layouts.lg).toHaveLength(6)
  })
})

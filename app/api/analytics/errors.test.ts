import { describe, expect, it } from "vitest"
import { ZodError } from "zod"

import {
  analyticsErrorResponse,
  analyticsUnknownErrorResponse,
  analyticsZodErrorResponse,
} from "@/app/api/analytics/errors"

describe("analytics API error mapping", () => {
  it("maps error codes to HTTP statuses", async () => {
    const cases = [
      ["unauthorized", 401],
      ["not_configured", 503],
      ["validation_error", 400],
      ["not_found", 404],
      ["rate_limited", 429],
      ["invalid_credentials", 502],
      ["insufficient_scope", 502],
      ["query_failed", 500],
    ] as const

    for (const [code, status] of cases) {
      const res = analyticsErrorResponse(code, "msg")
      expect(res.status).toBe(status)
      const body = await res.json()
      expect(body).toEqual({ error: "msg", code })
    }
  })

  it("redacts personal PostHog keys from response bodies", async () => {
    const res = analyticsErrorResponse(
      "unknown",
      "Bearer phx_abc123XYZ leaked into logs"
    )
    const body = await res.json()
    expect(body.error).toBe("Bearer [redacted] leaked into logs")
    expect(JSON.stringify(body)).not.toMatch(/phx_[A-Za-z0-9]+/)
  })

  it("maps Zod and unknown errors safely", async () => {
    const zodRes = analyticsZodErrorResponse(
      new ZodError([
        {
          code: "custom",
          path: ["filters"],
          message: "Invalid filters",
        },
      ])
    )
    expect(zodRes.status).toBe(400)
    await expect(zodRes.json()).resolves.toMatchObject({
      code: "validation_error",
      error: "Invalid filters",
    })

    const unknown = analyticsUnknownErrorResponse(
      new Error("boom phx_shouldredact999")
    )
    expect(unknown.status).toBe(500)
    const body = await unknown.json()
    expect(body.error).toContain("[redacted]")
    expect(body.error).not.toContain("phx_shouldredact999")
  })
})

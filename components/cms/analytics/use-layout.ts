"use client"

/**
 * Hook for loading, saving, and resetting the analytics layout document
 * via the /api/analytics/layout endpoints.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { AnalyticsLayoutDocument } from "@/lib/analytics/types"
import type { AnalyticsLayoutPutInput } from "@/lib/analytics/schemas"

export type LayoutHookState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; layout: AnalyticsLayoutDocument }

export function useLayout(activeClientId: string): {
  state: LayoutHookState
  isSaving: boolean
  saveLayout: (
    input: AnalyticsLayoutPutInput
  ) => Promise<{ ok: boolean; layout?: AnalyticsLayoutDocument; message?: string }>
  resetLayout: () => Promise<{
    ok: boolean
    layout?: AnalyticsLayoutDocument
    message?: string
  }>
} {
  const [state, setState] = useState<LayoutHookState>({ status: "loading" })
  const [isSaving, setIsSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Load layout on mount and whenever the active CMS client changes.
  useEffect(() => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: "loading" })

    void (async () => {
      try {
        const res = await fetch("/api/analytics/layout", {
          signal: ctrl.signal,
        })
        if (ctrl.signal.aborted) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setState({
            status: "error",
            message:
              (body as { error?: string; message?: string }).error ??
              (body as { message?: string }).message ??
              `Layout load failed (${res.status}).`,
          })
          return
        }
        const body = (await res.json()) as { layout: AnalyticsLayoutDocument }
        setState({ status: "ready", layout: body.layout })
      } catch (err) {
        if (ctrl.signal.aborted) return
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Could not load layout.",
        })
      }
    })()

    return () => {
      ctrl.abort()
    }
  }, [activeClientId])

  const saveLayout = useCallback(
    async (
      input: AnalyticsLayoutPutInput
    ): Promise<{
      ok: boolean
      layout?: AnalyticsLayoutDocument
      message?: string
    }> => {
      setIsSaving(true)
      try {
        const res = await fetch("/api/analytics/layout", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          return {
            ok: false,
            message:
              (body as { message?: string }).message ??
              `Save failed (${res.status}).`,
          }
        }
        const layout = (body as { layout: AnalyticsLayoutDocument }).layout
        setState({ status: "ready", layout })
        return { ok: true, layout }
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : "Save failed.",
        }
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  const resetLayout = useCallback(async (): Promise<{
    ok: boolean
    layout?: AnalyticsLayoutDocument
    message?: string
  }> => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/analytics/layout", { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          ok: false,
          message:
            (body as { message?: string }).message ??
            `Reset failed (${res.status}).`,
        }
      }
      const layout = (body as { layout: AnalyticsLayoutDocument }).layout
      setState({ status: "ready", layout })
      return { ok: true, layout }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Reset failed.",
      }
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { state, isSaving, saveLayout, resetLayout }
}

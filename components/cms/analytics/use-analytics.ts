"use client"

/**
 * Data-fetching hooks for the analytics dashboard.
 * All hooks use AbortController to cancel stale requests.
 * All hooks handle loading, error, and "not configured" states from the API.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  AnalyticsDashboardResponse,
  AnalyticsFilterDimension,
  AnalyticsFilterOption,
  AnalyticsGlobalFilters,
  AnalyticsLiveResponse,
  AnalyticsWidgetId,
} from "@/lib/analytics/types"

// ─── Dashboard data hook ───────────────────────────────────────────────────────

export type DashboardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not_configured" }
  | { status: "connection_error"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; data: AnalyticsDashboardResponse; fetchedAt: string }

export function useAnalyticsDashboard(
  filters: AnalyticsGlobalFilters,
  widgetIds: AnalyticsWidgetId[],
  activeClientId: string
): {
  state: DashboardState
  /** True while a background refetch is running (previous data is still visible). */
  isRefetching: boolean
  refetch: () => void
} {
  const [state, setState] = useState<DashboardState>({ status: "idle" })
  const [isRefetching, setIsRefetching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Stabilize object identity so filter rebuilds do not abort in a loop.
  // Include activeClientId so "Viewing as" switches force a clean refetch.
  const requestKey = JSON.stringify({ filters, widgetIds, activeClientId })
  const clientIdRef = useRef(activeClientId)

  // Client switches must drop prior-client data immediately.
  useEffect(() => {
    if (clientIdRef.current === activeClientId) return
    clientIdRef.current = activeClientId
    setState({ status: "loading" })
    setIsRefetching(false)
  }, [activeClientId])

  const fetch_ = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const payload = JSON.parse(requestKey) as {
      filters: AnalyticsGlobalFilters
      widgetIds: AnalyticsWidgetId[]
    }

    // If we already have data, use a soft refetch indicator instead of
    // reverting to the full loading skeleton.
    setState((prev) => {
      if (prev.status === "ready") {
        setIsRefetching(true)
        return prev
      }
      setIsRefetching(false)
      return { status: "loading" }
    })

    try {
      const res = await fetch("/api/analytics/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetIds: payload.widgetIds,
          filters: payload.filters,
        }),
        signal: ctrl.signal,
      })

      if (ctrl.signal.aborted) return

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          code?: string
          error?: string
          message?: string
        }
        const code = body.code
        const message = body.error ?? body.message

        if (code === "not_configured" || res.status === 503) {
          setState({ status: "not_configured" })
          return
        }
        if (
          code === "invalid_credentials" ||
          code === "insufficient_scope" ||
          code === "unauthorized"
        ) {
          setState({
            status: "connection_error",
            message:
              message ??
              "Could not load analytics. If this keeps happening, contact your Ampere account manager.",
          })
          return
        }
        setState({
          status: "error",
          message: message ?? `Request failed (${res.status}).`,
        })
        return
      }

      const data = (await res.json()) as AnalyticsDashboardResponse
      setIsRefetching(false)
      setState({ status: "ready", data, fetchedAt: data.fetchedAt })
    } catch (err) {
      if (ctrl.signal.aborted) return
      setIsRefetching(false)
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Could not load analytics data.",
      })
    }
  }, [requestKey])

  // Re-fetch whenever filters or widgetIds change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch lifecycle
    void fetch_()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetch_])

  return { state, isRefetching, refetch: fetch_ }
}

// ─── Live data hook ────────────────────────────────────────────────────────────

export type LiveState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ready"; data: AnalyticsLiveResponse }

/** Polls /api/analytics/live every `intervalMs` while the tab is visible. */
export function useAnalyticsLive(
  activeClientId: string,
  intervalMs = 30_000
): LiveState {
  const [state, setState] = useState<LiveState>({ status: "loading" })
  const abortRef = useRef<AbortController | null>(null)

  const fetchLive = useCallback(async () => {
    if (document.hidden) return

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch("/api/analytics/live", { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const code = body?.code as string | undefined
        if (code === "not_configured") {
          setState({ status: "unavailable" })
        } else {
          setState({ status: "error" })
        }
        return
      }
      const data = (await res.json()) as AnalyticsLiveResponse
      setState({ status: "ready", data })
    } catch {
      if (ctrl.signal.aborted) return
      setState({ status: "error" })
    }
  }, [])

  useEffect(() => {
    setState({ status: "loading" })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional live polling lifecycle
    void fetchLive()

    const id = setInterval(() => void fetchLive(), intervalMs)

    const handleVisibility = () => {
      if (!document.hidden) void fetchLive()
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", handleVisibility)
      abortRef.current?.abort()
    }
  }, [fetchLive, intervalMs, activeClientId])

  return state
}

// ─── Filter options hook ───────────────────────────────────────────────────────

export type FilterOptionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; options: AnalyticsFilterOption[] }
  | { status: "error" }

/**
 * Fetches dimension values for the filter builder.
 * Re-fetches when dimension or search changes.
 */
export function useFilterOptions(
  dimension: AnalyticsFilterDimension | null,
  search: string,
  filters: AnalyticsGlobalFilters
): FilterOptionsState {
  const [state, setState] = useState<FilterOptionsState>({ status: "idle" })
  const abortRef = useRef<AbortController | null>(null)

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    if (!dimension) {
      queueMicrotask(() => setState({ status: "idle" }))
      return
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl

    queueMicrotask(() => setState({ status: "loading" }))

    const parsedFilters = JSON.parse(filtersKey) as AnalyticsGlobalFilters
    const body = {
      dimension,
      search,
      filters: parsedFilters,
      limit: 50,
    }

    fetch("/api/analytics/filter-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (ctrl.signal.aborted) return
        if (!res.ok) {
          setState({ status: "error" })
          return
        }
        const data = await res.json()
        setState({
          status: "ready",
          options: data.options as AnalyticsFilterOption[],
        })
      })
      .catch(() => {
        if (ctrl.signal.aborted) return
        setState({ status: "error" })
      })

    return () => {
      ctrl.abort()
    }
  }, [dimension, search, filtersKey])

  return state
}

/**
 * PostHog analytics query orchestration: dashboard, filter options, live.
 * Server-only. Never returns personal API keys.
 */

import type {
  AnalyticsDashboardRequest,
  AnalyticsDashboardResponse,
  AnalyticsFilterOptionsRequest,
  AnalyticsFilterOptionsResponse,
  AnalyticsLiveResponse,
  AnalyticsWidgetId,
  WidgetResultEntry,
} from "@/lib/analytics/types"
import type { PostHogCredentials } from "@/lib/posthog/config"
import {
  POSTHOG_LIVE_CACHE_TTL_MS,
  POSTHOG_SERVER_CACHE_TTL_MS,
  cacheKey,
  getCached,
  setCached,
} from "@/lib/posthog/cache"
import {
  fetchLivePayload,
  runFilterOptionsQuery,
  runWidgetQuery,
} from "@/lib/posthog/widgets"

const MAX_CONCURRENT_WIDGETS = 6

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index]!)
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run()
  )
  await Promise.all(runners)
  return results
}

export async function fetchAnalyticsDashboard(
  credentials: PostHogCredentials,
  request: AnalyticsDashboardRequest,
  init?: { signal?: AbortSignal }
): Promise<AnalyticsDashboardResponse> {
  const key = cacheKey([
    "dashboard",
    credentials.clientId,
    credentials.projectId,
    request,
  ])
  const cached = getCached<AnalyticsDashboardResponse>(key)
  if (cached) return cached

  const uniqueIds = [...new Set(request.widgetIds)] as AnalyticsWidgetId[]
  const entries = await mapPool(
    uniqueIds,
    MAX_CONCURRENT_WIDGETS,
    (widgetId) =>
      runWidgetQuery(credentials, widgetId, request.filters, init?.signal)
  )

  const results: Partial<Record<AnalyticsWidgetId, WidgetResultEntry>> = {}
  for (const entry of entries) {
    results[entry.widgetId] = entry
  }

  const response: AnalyticsDashboardResponse = {
    filters: request.filters,
    results,
    fetchedAt: new Date().toISOString(),
  }
  setCached(key, response, POSTHOG_SERVER_CACHE_TTL_MS)
  return response
}

export async function fetchAnalyticsFilterOptions(
  credentials: PostHogCredentials,
  request: AnalyticsFilterOptionsRequest,
  init?: { signal?: AbortSignal }
): Promise<
  | { ok: true; data: AnalyticsFilterOptionsResponse }
  | { ok: false; code: string; message: string }
> {
  const limit = request.limit ?? 40
  const key = cacheKey([
    "filter-options",
    credentials.clientId,
    credentials.projectId,
    request.dimension,
    request.search ?? "",
    limit,
    request.filters,
  ])
  const cached = getCached<AnalyticsFilterOptionsResponse>(key)
  if (cached) return { ok: true, data: cached }

  const result = await runFilterOptionsQuery(
    credentials,
    request.dimension,
    request.filters,
    request.search,
    limit,
    init?.signal
  )
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message }
  }

  const data: AnalyticsFilterOptionsResponse = {
    dimension: request.dimension,
    options: result.options,
  }
  setCached(key, data, POSTHOG_SERVER_CACHE_TTL_MS)
  return { ok: true, data }
}

export async function fetchAnalyticsLive(
  credentials: PostHogCredentials,
  init?: { signal?: AbortSignal }
): Promise<
  | { ok: true; data: AnalyticsLiveResponse }
  | { ok: false; code: string; message: string }
> {
  const key = cacheKey([
    "live",
    credentials.clientId,
    credentials.projectId,
  ])
  const cached = getCached<AnalyticsLiveResponse>(key)
  if (cached) return { ok: true, data: cached }

  const live = await fetchLivePayload(credentials, init?.signal)
  if (!live.ok) {
    return { ok: false, code: live.code, message: live.message }
  }

  const data: AnalyticsLiveResponse = {
    activeVisitors: live.activeVisitors,
    activePages: live.activePages,
    liveSources: live.liveSources,
    fetchedAt: new Date().toISOString(),
  }
  setCached(key, data, POSTHOG_LIVE_CACHE_TTL_MS)
  return { ok: true, data }
}

"use client"

import { HelpPopover } from "./help-popover"
import { useAnalyticsLive } from "./use-analytics"
import { cn } from "@/lib/utils"

// ─── Pulse dot (signature design element) ────────────────────────────────────

function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2 shrink-0", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 duration-1000" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  )
}

// ─── LivePulseRail ────────────────────────────────────────────────────────────

interface LivePulseRailProps {
  activeClientId: string
  className?: string
}

/**
 * "Today's Pulse" live rail.
 *
 * Shows active visitor count (with an animated pulse dot) and the top pages
 * currently being viewed. Polls /api/analytics/live every 30 seconds while
 * the tab is visible.
 *
 * The pulse dot is the dashboard's signature design element: a subtle,
 * purposeful live indicator that anchors the real-time feel without
 * overwhelming the rest of the UI.
 */
export function LivePulseRail({
  activeClientId,
  className,
}: LivePulseRailProps) {
  const state = useAnalyticsLive(activeClientId, 30_000)

  // Don't render anything if the API isn't configured yet.
  if (state.status === "unavailable") return null

  const isLoading = state.status === "loading"
  const data = state.status === "ready" ? state.data : null

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-6 rounded-lg border bg-card px-5 py-4",
        className
      )}
    >
      {/* Active visitors */}
      <div className="flex items-center gap-3">
        <PulseDot />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Active right now
            </span>
            <HelpPopover metricId="active_visitors" side="bottom" />
          </div>
          {isLoading ? (
            <div className="mt-0.5 h-7 w-12 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-semibold font-heading tabular-nums leading-tight">
              {data?.activeVisitors ?? 0}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden self-stretch w-px bg-border lg:block" />

      {/* Active pages */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Viewed right now
          </span>
          <HelpPopover metricId="active_pages" side="bottom" />
        </div>
        {isLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: `${60 + i * 20}px` }}
              />
            ))}
          </div>
        ) : data?.activePages && data.activePages.length > 0 ? (
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {data.activePages.slice(0, 5).map((page) => (
              <div
                key={page.key}
                className="flex items-center gap-1.5 text-sm"
              >
                <span className="max-w-48 truncate font-medium leading-tight">
                  {page.label || page.key}
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary tabular-nums">
                  {page.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active pages.</p>
        )}
      </div>

      {/* Live sources (compact) */}
      {data?.liveSources && data.liveSources.length > 0 && (
        <>
          <div className="hidden self-stretch w-px bg-border lg:block" />
          <div className="shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Sources
              </span>
              <HelpPopover metricId="live_sources" side="bottom" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {data.liveSources.slice(0, 3).map((src) => (
                <div
                  key={src.key}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <span className="max-w-32 truncate text-muted-foreground">
                    {src.label || src.key}
                  </span>
                  <span className="shrink-0 text-xs font-medium tabular-nums">
                    {src.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Last updated hint */}
      {data && (
        <div className="self-end text-right text-xs text-muted-foreground/60 ml-auto shrink-0">
          Updates every 30s
        </div>
      )}
    </div>
  )
}

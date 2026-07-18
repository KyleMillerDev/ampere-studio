"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ChartBarLineIcon } from "@hugeicons/core-free-icons"
import { AlertTriangleIcon, InboxIcon, WifiOffIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ─── Widget skeleton ──────────────────────────────────────────────────────────

interface WidgetSkeletonProps {
  variant?: "kpi" | "chart" | "table"
  className?: string
}

export function WidgetSkeleton({
  variant = "kpi",
  className,
}: WidgetSkeletonProps) {
  return (
    <div className={cn("space-y-3 p-6", className)}>
      {variant === "kpi" && (
        <>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </>
      )}
      {variant === "chart" && (
        <>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-48 w-full" />
        </>
      )}
      {variant === "table" && (
        <>
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Widget error ─────────────────────────────────────────────────────────────

interface WidgetErrorProps {
  message?: string
  compact?: boolean
  className?: string
}

export function WidgetError({
  message,
  compact = false,
  className,
}: WidgetErrorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-6" : "gap-2 py-10",
        className
      )}
    >
      <AlertTriangleIcon
        className={cn(
          "text-muted-foreground/40",
          compact ? "size-5" : "size-6"
        )}
      />
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {message ?? "Could not load this widget."}
      </p>
    </div>
  )
}

// ─── Widget empty ─────────────────────────────────────────────────────────────

interface WidgetEmptyProps {
  reason?: string
  compact?: boolean
  className?: string
}

export function WidgetEmpty({
  reason,
  compact = false,
  className,
}: WidgetEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-6" : "gap-2 py-10",
        className
      )}
    >
      <InboxIcon
        className={cn(
          "text-muted-foreground/30",
          compact ? "size-5" : "size-6"
        )}
      />
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {reason ?? "No data for this period."}
      </p>
    </div>
  )
}

// ─── Coming soon card ─────────────────────────────────────────────────────────

/** Shown when analytics tracking is not yet configured for the current client. */
export function AnalyticsComingSoonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <HugeiconsIcon icon={ChartBarLineIcon} className="size-4" />
          </span>
          <div>
            <p className="font-semibold">Analytics coming soon</p>
            <p className="text-sm text-muted-foreground">
              Ampere Sites analytics has not been activated for this account yet.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Once activated, you will see page views, top sources, and conversion
        trends right here. Reach out to your Ampere contact to get started.
      </CardContent>
    </Card>
  )
}

// ─── Connection error card ────────────────────────────────────────────────────

interface ConnectionErrorCardProps {
  message?: string
}

export function AnalyticsConnectionErrorCard(
  // message prop reserved for internal logging; not surfaced to the user.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: ConnectionErrorCardProps
) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <WifiOffIcon className="size-4" />
          </span>
          <div>
            <p className="font-semibold">Could not load analytics</p>
            <p className="text-sm text-muted-foreground">
              Analytics data is temporarily unavailable. If this keeps happening,
              contact your Ampere account manager.
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

// ─── Generic full-page loading ────────────────────────────────────────────────

export function AnalyticsLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <WidgetSkeleton variant="kpi" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <WidgetSkeleton variant="chart" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <WidgetSkeleton variant="table" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

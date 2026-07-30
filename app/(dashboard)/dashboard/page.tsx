import { Suspense } from "react"

import { AnalyticsDashboard } from "@/components/cms/analytics/analytics-dashboard"
import { AnalyticsLoadingState } from "@/components/cms/analytics/widget-states"
import { RecentSubmissionsPanel } from "@/components/cms/recent-submissions-panel"
import { StripeSalesOverview } from "@/components/cms/stripe/stripe-sales-overview"
import { getActiveClientId } from "@/lib/cms/client-context"
import { getActiveClientFeatures } from "@/lib/cms/clients"
import { showAnalyticsInOverview } from "@/lib/cms/client-features"
import { listSubmissions } from "@/lib/cms/submissions"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [activeClientId, features, stripeSalesEnabled, recentSubmissions] =
    await Promise.all([
      getActiveClientId(),
      getActiveClientFeatures(),
      isStripeOrdersEnabled().catch(() => false),
      listSubmissions({ limit: 5 }).catch(() => []),
    ])

  if (stripeSalesEnabled) {
    return <StripeSalesOverview recentSubmissions={recentSubmissions} />
  }

  if (showAnalyticsInOverview(features)) {
    return (
      <Suspense fallback={<AnalyticsLoadingState />}>
        <AnalyticsDashboard
          activeClientId={activeClientId}
          headingTitle="Overview"
          headingDescription="Traffic, conversions, and engagement across your site."
        />
      </Suspense>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Sales insights appear here when Stripe orders are enabled for this
          workspace.
        </p>
      </div>
      <RecentSubmissionsPanel
        submissions={recentSubmissions}
        className="hidden lg:block"
      />
    </div>
  )
}

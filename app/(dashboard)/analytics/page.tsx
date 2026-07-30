/**
 * Analytics page — server gate.
 *
 * Renders the full client dashboard wrapped in a Suspense boundary.
 * The client dashboard handles all states:
 *   - `not_configured`: shows the coming-soon card (no PostHog key for client)
 *   - `connection_error`: shows a clear credential error
 *   - `loading`: shows skeletons
 *   - `ready`: shows the live dashboard
 *
 * Realty accounts (rentals enabled) see analytics on Overview instead.
 */
import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AnalyticsDashboard } from "@/components/cms/analytics/analytics-dashboard"
import { AnalyticsLoadingState } from "@/components/cms/analytics/widget-states"
import { PageHeading } from "@/components/cms/page-heading"
import { getActiveClientId } from "@/lib/cms/client-context"
import { getActiveClientFeatures } from "@/lib/cms/clients"
import { showAnalyticsInOverview } from "@/lib/cms/client-features"

export const metadata = { title: "Analytics" }

export default async function AnalyticsPage() {
  const features = await getActiveClientFeatures()
  if (showAnalyticsInOverview(features)) {
    redirect("/dashboard")
  }

  const activeClientId = await getActiveClientId()

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeading
            title="Analytics"
            description="Traffic, conversions, and engagement across your site."
          />
          <AnalyticsLoadingState />
        </div>
      }
    >
      <AnalyticsDashboard activeClientId={activeClientId} />
    </Suspense>
  )
}

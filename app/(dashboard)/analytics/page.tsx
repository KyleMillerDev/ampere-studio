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
 * `activeClientId` is passed from the server so "Viewing as" switches
 * (router.refresh) remount/refetch client data for the new client.
 */
import { Suspense } from "react"

import { AnalyticsDashboard } from "@/components/cms/analytics/analytics-dashboard"
import { AnalyticsLoadingState } from "@/components/cms/analytics/widget-states"
import { PageHeading } from "@/components/cms/page-heading"
import { getActiveClientId } from "@/lib/cms/client-context"

export const metadata = { title: "Analytics" }

export default async function AnalyticsPage() {
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

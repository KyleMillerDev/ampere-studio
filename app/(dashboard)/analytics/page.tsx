import { HugeiconsIcon } from "@hugeicons/react"
import { ChartBarLineIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "Analytics" }

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Analytics"
        description="Traffic, conversions, and engagement across your Ampere client sites."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HugeiconsIcon icon={ChartBarLineIcon} className="size-4" />
            </span>
            Coming soon
          </CardTitle>
          <CardDescription>
            We are wiring this page up to PostHog and Google Analytics. For now your
            events are still being captured.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Once connected, you will see pageviews, top referrers, and conversion trends
          right here.
        </CardContent>
      </Card>
    </div>
  )
}

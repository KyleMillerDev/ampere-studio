import { HugeiconsIcon } from "@hugeicons/react"
import { DollarCircleIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "Sales overview" }

export default function SalesOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Sales overview"
        description="Orders, revenue trends, and what is moving fastest this month."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HugeiconsIcon icon={DollarCircleIcon} className="size-4" />
            </span>
            Coming soon
          </CardTitle>
          <CardDescription>
            Sales reporting will land once the checkout integration is wired in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Plan to show revenue by day, top products, and refund tracking.
        </CardContent>
      </Card>
    </div>
  )
}

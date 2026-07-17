import { StripeSalesOverview } from "@/components/cms/stripe/stripe-sales-overview"
import { RecentSubmissionsPanel } from "@/components/cms/recent-submissions-panel"
import { listSubmissions } from "@/lib/cms/submissions"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [stripeSalesEnabled, recentSubmissions] = await Promise.all([
    isStripeOrdersEnabled().catch(() => false),
    listSubmissions({ limit: 5 }).catch(() => []),
  ])

  if (!stripeSalesEnabled) {
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

  return <StripeSalesOverview recentSubmissions={recentSubmissions} />
}

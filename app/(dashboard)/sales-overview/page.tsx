import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { StripeSalesOverview } from "@/components/cms/stripe/stripe-sales-overview"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"

export const metadata = { title: "Sales overview" }

export default async function SalesOverviewPage() {
  const enabled = await isStripeOrdersEnabled().catch(() => false)
  if (!enabled) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <PageHeading
        title="Sales overview"
        description="Revenue trends, top products, and order insights from Stripe."
      />
      <StripeSalesOverview />
    </div>
  )
}

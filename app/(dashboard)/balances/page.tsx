import { redirect } from "next/navigation"

import { StripeBalancesPage } from "@/components/cms/stripe/stripe-balances-page"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"

export const dynamic = "force-dynamic"

export default async function BalancesPage() {
  const enabled = await isStripeOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  return <StripeBalancesPage />
}

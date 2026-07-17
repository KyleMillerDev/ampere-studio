import { redirect } from "next/navigation"

import { isSquareOrdersEnabled } from "@/lib/square/config"
import { SalesOverview } from "@/components/cms/square/sales-overview"

export const dynamic = "force-dynamic"

export default async function SquareAnalyticsPage() {
  const enabled = await isSquareOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  return <SalesOverview />
}

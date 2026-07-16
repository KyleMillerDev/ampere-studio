import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareOrdersTable } from "@/components/cms/square/square-orders-table"
import { isSquareOrdersEnabled } from "@/lib/square/config"
import { listSquareOrders } from "@/lib/square/orders"

export const dynamic = "force-dynamic"

export default async function SquareOrdersPage() {
  const enabled = await isSquareOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  const orders = await listSquareOrders({ limit: 200 }).catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Orders"
        description="All Square orders from the local mirror, sorted newest first."
      />
      <SquareOrdersTable orders={orders} />
    </div>
  )
}

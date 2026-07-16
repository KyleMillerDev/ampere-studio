import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { OrdersTable } from "@/components/cms/stripe/orders/orders-table"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { listStripeOrders } from "@/lib/stripe/orders"
import { getCatalogMap } from "@/lib/stripe/catalog"
import type { CatalogProduct } from "@/lib/stripe/catalog"

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  const enabled = await isStripeOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  const [orders, catalogMap] = await Promise.all([
    listStripeOrders().catch(() => []),
    getCatalogMap().catch(() => new Map<string, CatalogProduct>()),
  ])

  const catalogProducts = Array.from(
    new Map(Array.from(catalogMap.values()).map((p) => [p.id, p])).values()
  )

  return (
    <div className="space-y-6">
      <PageHeading
        title="Orders"
        description="All Stripe orders for this account."
      />
      <OrdersTable orders={orders} catalogProducts={catalogProducts} />
    </div>
  )
}

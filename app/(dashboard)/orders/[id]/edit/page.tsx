import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { getStripeOrder } from "@/lib/stripe/orders"
import { getCatalogMap } from "@/lib/stripe/catalog"
import type { CatalogProduct } from "@/lib/stripe/catalog"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { OrderEditor } from "@/components/cms/stripe/orders/order-editor"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export default async function EditOrderPage({ params }: Ctx) {
  const enabled = await isStripeOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  const { id } = await params
  const [order, catalogMap] = await Promise.all([
    getStripeOrder(id),
    getCatalogMap().catch(() => new Map<string, CatalogProduct>()),
  ])

  if (!order) notFound()

  const catalogProducts = Array.from(
    new Map(Array.from(catalogMap.values()).map((p) => [p.id, p])).values()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/orders/${id}`}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            Edit Order #{order.confirmationNumber}
          </h1>
          <p className="text-sm text-muted-foreground">{order.id}</p>
        </div>
      </div>

      <OrderEditor order={order} catalogProducts={catalogProducts} />
    </div>
  )
}

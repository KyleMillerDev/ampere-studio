import { notFound, redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareOrderLineItems } from "@/components/cms/square/square-order-line-items"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildVariationProductIndex } from "@/lib/square/catalog-resolve"
import { isSquareOrdersEnabled } from "@/lib/square/config"
import { getSquareOrder } from "@/lib/square/orders"
import { listSquareProducts } from "@/lib/square/products"
import type { KmOrderState } from "@/lib/square/types"

type Props = { params: Promise<{ id: string }> }

function formatMoney(amount?: number): string {
  if (amount === undefined) return "—"
  return `$${(amount / 100).toFixed(2)}`
}

export const dynamic = "force-dynamic"

export default async function SquareOrderDetailPage({ params }: Props) {
  const { id } = await params
  const enabled = await isSquareOrdersEnabled()
  if (!enabled) redirect("/square/orders")

  const order = await getSquareOrder(id)
  if (!order) notFound()

  const state = (order.km_state ?? "OPEN") as KmOrderState
  const fulfillment = order.fulfillments?.[0]
  const variationIndex = buildVariationProductIndex(await listSquareProducts())
  const productByCatalogId = Object.fromEntries(variationIndex.entries())

  return (
    <div className="space-y-6">
      <PageHeading
        title={`Order ${order.id.slice(-8)}`}
        description={`Square order placed on ${new Date(order.created_at).toLocaleDateString()}`}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Line items */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Items
                <Badge>{state.replace("_", " ")}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <SquareOrderLineItems
                  items={order.line_items ?? []}
                  productByCatalogId={productByCatalogId}
                />
                <div className="space-y-1 border-t pt-3 text-sm">
                  {order.total_discount_money?.amount ? (
                    <div className="flex justify-between text-green-600">
                      <span>Discounts</span>
                      <span>
                        -{formatMoney(order.total_discount_money.amount)}
                      </span>
                    </div>
                  ) : null}
                  {order.total_tax_money?.amount ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax</span>
                      <span>{formatMoney(order.total_tax_money.amount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatMoney(order.total_money?.amount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fulfillment + actions */}
        <div className="space-y-4">
          {fulfillment && (
            <Card>
              <CardHeader>
                <CardTitle>Fulfillment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  {fulfillment.type}
                </p>
                <p>
                  <span className="text-muted-foreground">State:</span>{" "}
                  {fulfillment.state}
                </p>
                {fulfillment.shipment_details?.tracking_number && (
                  <p>
                    <span className="text-muted-foreground">Tracking:</span>{" "}
                    {fulfillment.shipment_details.tracking_number}
                  </p>
                )}
                {fulfillment.shipment_details?.carrier && (
                  <p>
                    <span className="text-muted-foreground">Carrier:</span>{" "}
                    {fulfillment.shipment_details.carrier}
                  </p>
                )}
                {fulfillment.pickup_details?.pickup_at && (
                  <p>
                    <span className="text-muted-foreground">Pickup at:</span>{" "}
                    {new Date(
                      fulfillment.pickup_details.pickup_at
                    ).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state !== "CANCELED" && state !== "COMPLETED" && (
                <FulfillmentActions
                  orderId={order.id}
                  fulfillmentUid={fulfillment?.uid}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FulfillmentActions({
  orderId,
  fulfillmentUid,
}: {
  orderId: string
  fulfillmentUid?: string
}) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Use the fulfillment API to update this order&apos;s status.</p>
      {fulfillmentUid && (
        <p className="font-mono text-xs break-all">
          Fulfillment UID: {fulfillmentUid}
        </p>
      )}
    </div>
  )
}

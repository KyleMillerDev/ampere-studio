import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { getStripeOrder, carrierTrackingUrl } from "@/lib/stripe/orders"
import { formatStripeAmount, formatUnixDate } from "@/lib/utils"
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { OrderActions } from "@/components/cms/stripe/orders/order-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export default async function OrderDetailPage({ params }: Ctx) {
  const enabled = await isStripeOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  const { id } = await params
  const order = await getStripeOrder(id)
  if (!order) notFound()

  const trackingUrl =
    order.tracking && order.trackingCarrier
      ? carrierTrackingUrl(order.trackingCarrier, order.tracking)
      : null

  const addr = order.shipping?.address
  const addressLines = addr
    ? [
        addr.line1,
        addr.line2,
        [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
        addr.country,
      ].filter(Boolean)
    : []

  return (
    <div className="space-y-6">
      {/* Back + heading */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/orders">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              Order #{order.confirmationNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              {order.id} &middot; Placed {formatUnixDate(order.created)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderActions order={order} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left col: items + totals */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No line items parsed.
                </p>
              ) : (
                order.lineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.name}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <HugeiconsIcon
                          icon={Image01Icon}
                          className="size-5 text-muted-foreground"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} ×{" "}
                        {item.unitAmount !== null
                          ? formatStripeAmount(item.unitAmount, order.currency)
                          : "—"}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">
                      {item.lineTotal !== null
                        ? formatStripeAmount(item.lineTotal, order.currency)
                        : "—"}
                    </p>
                  </div>
                ))
              )}

              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>
                    {order.subtotal !== null
                      ? formatStripeAmount(order.subtotal, order.currency)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>
                    {order.shippingCost !== null
                      ? formatStripeAmount(order.shippingCost, order.currency)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>
                    {formatStripeAmount(order.amount, order.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["Paid", "Shipped", "Complete"] as const).map((s) => (
                  <div
                    key={s}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                      order.status === s
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : order.status === "Cancelled" ||
                            order.status === "Disputed" ||
                            order.status === "Failed"
                          ? "opacity-40"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s}
                  </div>
                ))}
                {(order.status === "Cancelled" ||
                  order.status === "Disputed" ||
                  order.status === "Failed") && (
                  <div className="flex items-center gap-2 rounded-full border border-destructive/50 bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                    {order.status}
                  </div>
                )}
              </div>
              {order.statusOverride && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Status override: <strong>{order.statusOverride}</strong>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right col: customer + shipping + tracking */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {order.customerName && (
                <p className="font-medium">{order.customerName}</p>
              )}
              {order.customerEmail && (
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-primary hover:underline"
                >
                  {order.customerEmail}
                </a>
              )}
              {order.shipping?.phone && (
                <p className="text-muted-foreground">{order.shipping.phone}</p>
              )}
              {!order.customerName && !order.customerEmail && (
                <p className="text-muted-foreground">No customer info.</p>
              )}
            </CardContent>
          </Card>

          {/* Shipping address */}
          {addressLines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ship to</CardTitle>
              </CardHeader>
              <CardContent>
                <address className="text-sm leading-relaxed not-italic">
                  {order.shipping?.name && (
                    <div className="font-medium">{order.shipping.name}</div>
                  )}
                  {addressLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </address>
              </CardContent>
            </Card>
          )}

          {/* Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Tracking</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {order.tracking ? (
                <div className="space-y-1">
                  {trackingUrl ? (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {order.tracking}
                    </a>
                  ) : (
                    <p className="font-medium">{order.tracking}</p>
                  )}
                  {order.trackingCarrier && (
                    <p className="text-muted-foreground">
                      via {order.trackingCarrier}
                    </p>
                  )}
                  {order.shippedAt && (
                    <p className="text-muted-foreground">
                      Shipped {formatUnixDate(order.shippedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No tracking yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/orders/${order.id}/edit`}>Edit order</Link>
              </Button>
              {order.customerEmail && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${order.customerEmail}`}>Email customer</a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

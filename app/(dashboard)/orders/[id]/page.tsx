import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { getStripeOrder, carrierTrackingUrl } from "@/lib/stripe/orders"
import {
  formatPhone,
  formatStripeAmount,
  formatUnixDate,
  formatUnixDateTime,
} from "@/lib/utils"
import { OrderStatusBadge } from "@/components/cms/stripe/orders/order-status-badge"
import { OrderAmount } from "@/components/cms/stripe/orders/order-amount"
import { OrderLineItems } from "@/components/cms/stripe/orders/order-line-items"
import { OrderHistory } from "@/components/cms/stripe/orders/order-history"
import { OrderActions } from "@/components/cms/stripe/orders/order-actions"
import { buildOrderLineChanges } from "@/lib/stripe/orders"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function refundReasonLabel(reason: string | null): string | null {
  if (!reason) return null
  switch (reason) {
    case "duplicate":
      return "Duplicate"
    case "fraudulent":
      return "Fraudulent"
    case "requested_by_customer":
      return "Requested by customer"
    case "order_edit":
      return "Order edit"
    default:
      return reason.replace(/_/g, " ")
  }
}

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

  const hasRefund = order.refundedAmount > 0
  const refundLabel = order.isRefunded
    ? "Fully refunded"
    : order.isPartiallyRefunded
      ? "Partially refunded"
      : null
  const lineChanges = buildOrderLineChanges(
    order.originalLineItems,
    order.lineItems
  )
  const wasEdited = lineChanges !== null

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
              <OrderLineItems
                lineItems={order.lineItems}
                originalLineItems={order.originalLineItems}
                currency={order.currency}
              />
              {wasEdited && order.editedAt && (
                <p className="text-xs text-muted-foreground">
                  First edited {formatUnixDateTime(order.editedAt)}
                </p>
              )}

              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="inline-flex flex-col items-end gap-0.5">
                    {wasEdited &&
                      order.originalSubtotal !== null &&
                      order.subtotal !== null &&
                      order.originalSubtotal !== order.subtotal && (
                        <span className="text-xs line-through">
                          {formatStripeAmount(
                            order.originalSubtotal,
                            order.currency
                          )}
                        </span>
                      )}
                    <span>
                      {order.subtotal !== null
                        ? formatStripeAmount(order.subtotal, order.currency)
                        : "—"}
                    </span>
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
                  <OrderAmount
                    amount={order.amount}
                    refundedAmount={order.refundedAmount}
                    currency={order.currency}
                    className="items-end text-base"
                    netClassName="font-semibold"
                    originalClassName="text-sm"
                  />
                </div>
                {hasRefund && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Refunded</span>
                      <span>
                        −
                        {formatStripeAmount(
                          order.refundedAmount,
                          order.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Net</span>
                      <span>
                        {formatStripeAmount(order.netAmount, order.currency)}
                      </span>
                    </div>
                  </>
                )}
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
                            order.status === "Refunded" ||
                            order.status === "Partially Refunded" ||
                            order.status === "Disputed" ||
                            order.status === "Failed" ||
                            order.status === "Abandoned" ||
                            order.status === "Checking out"
                          ? "opacity-40"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s}
                  </div>
                ))}
                {(order.status === "Cancelled" ||
                  order.status === "Refunded" ||
                  order.status === "Partially Refunded" ||
                  order.status === "Disputed" ||
                  order.status === "Failed" ||
                  order.status === "Abandoned" ||
                  order.status === "Checking out") && (
                  <div
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${
                      order.status === "Partially Refunded"
                        ? "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                        : order.status === "Refunded" ||
                            order.status === "Abandoned"
                          ? "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                          : order.status === "Checking out"
                            ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                            : "border-destructive/50 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {order.status}
                  </div>
                )}
                {order.archived && (
                  <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                    Archived
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

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderHistory events={order.history} />
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
                <p className="text-muted-foreground">
                  Phone:{" "}
                  <a
                    href={`tel:${order.shipping.phone.replace(/\D/g, "")}`}
                    className="hover:underline"
                  >
                    {formatPhone(order.shipping.phone)}
                  </a>
                </p>
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

          {/* Refunds */}
          {hasRefund && (
            <Card>
              <CardHeader>
                <CardTitle>Refunds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  {refundLabel && <p className="font-medium">{refundLabel}</p>}
                  {wasEdited && (
                    <p className="text-muted-foreground">
                      Line items were changed after checkout. See Items for
                      original vs current quantities.
                    </p>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Original total</span>
                    <span>
                      {formatStripeAmount(order.amount, order.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total refunded</span>
                    <span>
                      {formatStripeAmount(order.refundedAmount, order.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Net kept</span>
                    <span>
                      {formatStripeAmount(order.netAmount, order.currency)}
                    </span>
                  </div>
                </div>

                {order.refunds.length > 0 ? (
                  <>
                    <Separator />
                    <ul className="space-y-3">
                      {order.refunds.map((refund) => {
                        const reason = refundReasonLabel(refund.reason)
                        return (
                          <li key={refund.id} className="space-y-0.5">
                            <div className="flex justify-between gap-3">
                              <span className="font-medium">
                                {formatStripeAmount(
                                  refund.amount,
                                  order.currency
                                )}
                              </span>
                              <span className="text-muted-foreground capitalize">
                                {refund.status}
                              </span>
                            </div>
                            <p className="text-muted-foreground">
                              {formatUnixDateTime(refund.created)}
                              {reason ? ` · ${reason}` : ""}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Refund recorded on the charge. Individual refund details
                    were not available.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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

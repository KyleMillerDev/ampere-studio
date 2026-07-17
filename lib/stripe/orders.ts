import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe/config"
import { StripeNotConfiguredError } from "@/lib/stripe/products"
import { getCatalogMap } from "@/lib/stripe/catalog"
import type { CatalogMap, CatalogProduct } from "@/lib/stripe/catalog-types"
import { formatStripeAmount } from "@/lib/utils"
import {
  buildLinesMetadata,
  CHECKOUT_ABANDON_SECONDS,
  confirmationNumber,
  orderNetAmount,
  parseLineMetadata,
  type EnrichedLineItem,
  type OrderHistoryEvent,
  type OrderLineRef,
  type OrderPaymentMethod,
  type OrderRefund,
  type OrderStatus,
  type OrderView,
  type StatusOverride,
  type TrackingCarrier,
} from "@/lib/stripe/order-model"

export type {
  EnrichedLineItem,
  OrderHistoryEvent,
  OrderHistoryKind,
  OrderLineChange,
  OrderLineRef,
  OrderPaymentMethod,
  OrderRefund,
  OrderStatus,
  OrderView,
  StatusOverride,
  TrackingCarrier,
} from "@/lib/stripe/order-model"

export {
  buildLinesMetadata,
  buildOrderLineChanges,
  carrierTrackingUrl,
  CHECKOUT_ABANDON_SECONDS,
  confirmationNumber,
  formatOrderProductName,
  OPT_IN_ORDER_STATUS_FILTERS,
  orderLineQuantitiesDiffer,
  orderNetAmount,
  parseLineMetadata,
} from "@/lib/stripe/order-model"

/** Expand paths for PaymentIntent order reads. */
const ORDER_EXPAND = [
  "latest_charge",
  "latest_charge.refunds",
  "latest_charge.dispute",
] as const
const ORDER_LIST_EXPAND = [
  "data.latest_charge",
  "data.latest_charge.refunds",
  "data.latest_charge.dispute",
] as const

/** Enrich parsed line refs against the catalog map. */
export function buildEnrichedOrderItems(
  refs: OrderLineRef[],
  catalogMap: CatalogMap
): EnrichedLineItem[] {
  return refs.map(({ ref, quantity }) => {
    const product: CatalogProduct | undefined = catalogMap.get(ref)
    if (!product) {
      return {
        ref,
        productId: null,
        name: `Missing (${ref})`,
        slug: null,
        partNumber: null,
        image: null,
        quantity,
        unitAmount: null,
        lineTotal: null,
      }
    }
    return {
      ref,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      partNumber: product.partNumber,
      image: product.image,
      quantity,
      unitAmount: product.unitAmount,
      lineTotal:
        product.unitAmount !== null ? product.unitAmount * quantity : null,
    }
  })
}

/** Resolve customer email from PaymentIntent, with latest_charge fallback. */
export function getCustomerEmail(pi: Stripe.PaymentIntent): string | null {
  if (pi.receipt_email) return pi.receipt_email
  const charge = pi.latest_charge
  if (charge && typeof charge !== "string") {
    return charge.billing_details?.email ?? null
  }
  return null
}

/** Returns true when a charge has an active dispute. */
function hasActiveDispute(charge: Stripe.Charge | null): boolean {
  if (!charge) return false
  return charge.disputed === true
}

/** Returns true when a charge has been fully refunded. */
function isFullyRefunded(charge: Stripe.Charge | null): boolean {
  if (!charge) return false
  return charge.refunded === true
}

/** Returns true when a charge has a partial (non-zero, non-full) refund. */
function isPartiallyRefundedCharge(charge: Stripe.Charge | null): boolean {
  if (!charge) return false
  const refunded = charge.amount_refunded ?? 0
  return refunded > 0 && charge.refunded !== true
}

/** Resolve the latest_charge object (expanded or null). */
function resolveCharge(pi: Stripe.PaymentIntent): Stripe.Charge | null {
  if (!pi.latest_charge) return null
  if (typeof pi.latest_charge === "string") return null
  return pi.latest_charge as Stripe.Charge
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  card: "Card",
  link: "Link",
  amazon_pay: "Amazon Pay",
  affirm: "Affirm",
  afterpay_clearpay: "Afterpay",
  alipay: "Alipay",
  cashapp: "Cash App",
  klarna: "Klarna",
  paypal: "PayPal",
  us_bank_account: "Bank account",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
}

function titleCaseType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Normalize charge.payment_method_details into a list-friendly shape. */
export function extractPaymentMethod(
  charge: Stripe.Charge | null
): OrderPaymentMethod | null {
  const details = charge?.payment_method_details
  if (!details?.type) return null

  const type = details.type

  if (type === "card" && details.card) {
    const brand = details.card.brand ?? null
    const last4 = details.card.last4 ?? null
    return {
      type: "card",
      brand,
      last4,
      label: last4 ? `•••• ${last4}` : (PAYMENT_TYPE_LABELS.card ?? "Card"),
    }
  }

  if (type === "link") {
    return {
      type: "link",
      brand: "link",
      last4: null,
      label: "Link",
    }
  }

  return {
    type,
    brand: type,
    last4: null,
    label: PAYMENT_TYPE_LABELS[type] ?? titleCaseType(type),
  }
}

/** Map expanded charge.refunds into OrderRefund records. */
function extractRefunds(charge: Stripe.Charge | null): OrderRefund[] {
  const data = charge?.refunds?.data
  if (!data?.length) return []
  return [...data]
    .map((r) => ({
      id: r.id,
      amount: r.amount,
      created: r.created,
      status: r.status ?? "unknown",
      reason: r.reason ?? r.metadata?.reason ?? null,
    }))
    .sort((a, b) => b.created - a.created)
}

/**
 * True when a PaymentIntent looks like an abandoned / unfinished checkout
 * with no payment attempt outcome. Failed attempts are NOT incomplete.
 */
export function isIncompletePaymentIntent(pi: Stripe.PaymentIntent): boolean {
  if (
    pi.status === "succeeded" ||
    pi.status === "canceled" ||
    pi.status === "requires_capture"
  ) {
    return false
  }

  // Failed card/bank attempts leave an error (and often a failed charge).
  if (pi.last_payment_error) return false
  const charge = resolveCharge(pi)
  if (charge?.status === "failed") return false

  return (
    pi.status === "requires_payment_method" ||
    pi.status === "requires_confirmation" ||
    pi.status === "requires_action" ||
    pi.status === "processing"
  )
}

function hasFailedPayment(
  pi: Stripe.PaymentIntent,
  charge: Stripe.Charge | null
): boolean {
  if (pi.last_payment_error) return true
  return charge?.status === "failed"
}

/**
 * Build a user-facing timeline from PaymentIntent + charge state.
 * Skips developer-only Stripe event noise (charge IDs, raw object updates).
 */
export function buildOrderHistory(
  pi: Stripe.PaymentIntent,
  charge: Stripe.Charge | null,
  refunds: OrderRefund[]
): OrderHistoryEvent[] {
  const events: OrderHistoryEvent[] = []
  const currency = pi.currency

  events.push({
    id: `${pi.id}:started`,
    kind: "payment_started",
    label: "Payment started",
    created: pi.created,
  })

  if (pi.status === "requires_action") {
    events.push({
      id: `${pi.id}:pending_verification`,
      kind: "pending_verification",
      label: "Pending verification",
      created: pi.created,
    })
  }

  if (pi.status === "processing") {
    events.push({
      id: `${pi.id}:processing`,
      kind: "payment_processing",
      label: "Payment processing",
      created: charge?.created ?? pi.created,
    })
  }

  if (hasFailedPayment(pi, charge)) {
    events.push({
      id: `${pi.id}:failed`,
      kind: "payment_failed",
      label: "Payment failed",
      created: charge?.created ?? pi.created,
    })
  }

  if (pi.status === "requires_capture") {
    events.push({
      id: `${pi.id}:authorized`,
      kind: "payment_authorized",
      label: "Payment authorized",
      created: charge?.created ?? pi.created,
    })
  }

  if (pi.status === "succeeded") {
    events.push({
      id: `${pi.id}:succeeded`,
      kind: "payment_succeeded",
      label: "Payment succeeded",
      created: charge?.created ?? pi.created,
    })
  }

  if (pi.status === "canceled" && pi.canceled_at) {
    events.push({
      id: `${pi.id}:cancelled`,
      kind: "payment_cancelled",
      label: "Payment cancelled",
      created: pi.canceled_at,
    })
  }

  for (const refund of refunds) {
    const amountLabel = formatStripeAmount(refund.amount, currency)
    const fromEdit = refund.reason === "order_edit"
    events.push({
      id: refund.id,
      kind: "refund",
      label: fromEdit
        ? `Refund from order edit (${amountLabel})`
        : `Refund issued (${amountLabel})`,
      created: refund.created,
    })
  }

  const editedAtStr = pi.metadata?.edited_at
  const editedAt = editedAtStr ? parseInt(editedAtStr, 10) : null
  if (editedAt) {
    events.push({
      id: `${pi.id}:edited`,
      kind: "edited",
      label: "Order edited",
      created: editedAt,
    })
  }

  const shippedAtStr = pi.metadata?.shipped_at
  const shippedAt = shippedAtStr ? parseInt(shippedAtStr, 10) : null
  if (shippedAt) {
    events.push({
      id: `${pi.id}:shipped`,
      kind: "shipped",
      label: "Order shipped",
      created: shippedAt,
    })
  }

  // Stripe expands `latest_charge.dispute` as a Dispute object when present.
  const dispute = (
    charge as
      | (Stripe.Charge & { dispute?: Stripe.Dispute | string | null })
      | null
  )?.dispute
  if (dispute && typeof dispute !== "string") {
    events.push({
      id: dispute.id,
      kind: "disputed",
      label: "Dispute opened",
      created: dispute.created,
    })
  }

  return events.sort((a, b) => {
    if (b.created !== a.created) return b.created - a.created
    return a.label.localeCompare(b.label)
  })
}

export function isArchivedPaymentIntent(pi: Stripe.PaymentIntent): boolean {
  return pi.metadata?.archived === "true"
}

/**
 * Derive the display status for a PaymentIntent.
 * Incomplete: Checking out (<15m) or Abandoned (>=15m).
 * Non-succeeded: Failed (attempted) or Cancelled.
 * Succeeded priority:
 *   Disputed > Refunded > Cancelled > Partially Refunded > Complete > Shipped > Paid
 * Archived is a separate metadata flag (order.archived), not a status.
 */
export function deriveOrderStatus(
  pi: Stripe.PaymentIntent,
  charge: Stripe.Charge | null
): OrderStatus {
  if (isIncompletePaymentIntent(pi)) {
    const ageSeconds = Math.floor(Date.now() / 1000) - pi.created
    if (ageSeconds < CHECKOUT_ABANDON_SECONDS) return "Checking out"
    return "Abandoned"
  }

  if (pi.status !== "succeeded") {
    if (hasFailedPayment(pi, charge)) return "Failed"
    if (pi.status === "canceled") return "Cancelled"
    // Authorized but not captured yet.
    if (pi.status === "requires_capture") return "Paid"
    return "Failed"
  }

  if (hasActiveDispute(charge)) return "Disputed"

  if (isFullyRefunded(charge)) return "Refunded"

  const override = pi.metadata?.status_override as StatusOverride | undefined

  if (override === "cancelled") return "Cancelled"
  if (isPartiallyRefundedCharge(charge)) return "Partially Refunded"
  if (override === "complete") return "Complete"
  if (override === "shipped" || (pi.metadata?.tracking ?? "").length > 0)
    return "Shipped"

  return "Paid"
}

function toOrderView(
  pi: Stripe.PaymentIntent,
  catalogMap: CatalogMap
): OrderView {
  const charge = resolveCharge(pi)
  const refs = parseLineMetadata(pi.metadata?.lines)
  const lineItems = buildEnrichedOrderItems(refs, catalogMap)
  const originalRefs = parseLineMetadata(pi.metadata?.original_lines)
  const originalLineItems = buildEnrichedOrderItems(originalRefs, catalogMap)
  const status = deriveOrderStatus(pi, charge)
  const tracking = (pi.metadata?.tracking ?? "") || null
  const rawCarrier = pi.metadata?.tracking_carrier as string | undefined
  const trackingCarrier: TrackingCarrier | null =
    rawCarrier === "USPS" ||
    rawCarrier === "UPS" ||
    rawCarrier === "FEDEX" ||
    rawCarrier === "Other"
      ? rawCarrier
      : null

  const shippedAtStr = pi.metadata?.shipped_at
  const shippedAt = shippedAtStr ? parseInt(shippedAtStr, 10) : null

  const editedAtStr = pi.metadata?.edited_at
  const editedAt = editedAtStr ? parseInt(editedAtStr, 10) : null

  const subtotalStr = pi.metadata?.subtotal
  const subtotal = subtotalStr ? parseInt(subtotalStr, 10) : null

  const originalSubtotalStr = pi.metadata?.original_subtotal
  const originalSubtotal = originalSubtotalStr
    ? parseInt(originalSubtotalStr, 10)
    : null

  const shippingCostStr = pi.metadata?.shipping
  const shippingCost = shippingCostStr ? parseInt(shippingCostStr, 10) : null

  const refundedAmount = charge?.amount_refunded ?? 0
  const fullyRefunded = isFullyRefunded(charge)
  const partiallyRefunded = isPartiallyRefundedCharge(charge)
  const refunds = extractRefunds(charge)
  const archived = isArchivedPaymentIntent(pi)

  return {
    id: pi.id,
    confirmationNumber: confirmationNumber(pi.id),
    amount: pi.amount,
    currency: pi.currency,
    status,
    created: pi.created,
    customerEmail: getCustomerEmail(pi),
    customerName: pi.shipping?.name ?? null,
    shipping: pi.shipping ?? null,
    lineItems,
    originalLineItems,
    subtotal,
    originalSubtotal,
    shippingCost,
    tracking,
    trackingCarrier,
    shippedAt,
    editedAt,
    statusOverride: (pi.metadata?.status_override as StatusOverride) ?? null,
    archived,
    rawMetadata: { ...pi.metadata } as Record<string, string>,
    hasDispute: hasActiveDispute(charge),
    isRefunded: fullyRefunded,
    isPartiallyRefunded: partiallyRefunded,
    refundedAmount,
    netAmount: orderNetAmount(pi.amount, refundedAmount),
    refunds,
    history: buildOrderHistory(pi, charge, refunds),
    paymentMethod: extractPaymentMethod(charge),
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

async function requireStripe() {
  const stripe = await getStripeClient()
  if (!stripe) throw new StripeNotConfiguredError()
  return stripe
}

export async function listStripeOrders(): Promise<OrderView[]> {
  const stripe = await requireStripe()
  const catalogMap = await getCatalogMap()
  const orders: OrderView[] = []

  for await (const pi of stripe.paymentIntents.list({
    limit: 100,
    expand: [...ORDER_LIST_EXPAND],
  })) {
    // Include incomplete checkouts as Checking out / Abandoned (opt-in in UI).
    orders.push(toOrderView(pi, catalogMap))
  }

  return orders
}

export async function getStripeOrder(id: string): Promise<OrderView | null> {
  const stripe = await requireStripe()
  const catalogMap = await getCatalogMap()

  try {
    const pi = await stripe.paymentIntents.retrieve(id, {
      expand: [...ORDER_EXPAND],
    })
    return toOrderView(pi, catalogMap)
  } catch (err) {
    const e = err as { code?: string }
    if (e?.code === "resource_missing") return null
    throw err
  }
}

// ---------------------------------------------------------------------------
// Write helpers (ALWAYS merge metadata: spread existing, then set new keys)
// ---------------------------------------------------------------------------

export async function addTracking(
  id: string,
  {
    tracking,
    tracking_carrier,
  }: { tracking: string; tracking_carrier: TrackingCarrier }
): Promise<OrderView> {
  const stripe = await requireStripe()
  const pi = await stripe.paymentIntents.retrieve(id)
  const isFirstTracking = !(pi.metadata?.tracking ?? "")

  const updated = await stripe.paymentIntents.update(id, {
    metadata: {
      ...pi.metadata,
      tracking,
      tracking_carrier,
      ...(isFirstTracking
        ? { shipped_at: String(Math.floor(Date.now() / 1000)) }
        : {}),
    },
  })

  const catalogMap = await getCatalogMap()
  const charge = resolveCharge(updated)
  return toOrderView(updated, catalogMap)
}

export async function setStatusOverride(
  id: string,
  statusOverride: StatusOverride | ""
): Promise<OrderView> {
  const stripe = await requireStripe()
  const pi = await stripe.paymentIntents.retrieve(id)

  const updated = await stripe.paymentIntents.update(id, {
    metadata: {
      ...pi.metadata,
      status_override: statusOverride,
    },
  })

  const catalogMap = await getCatalogMap()
  return toOrderView(updated, catalogMap)
}

export async function setOrderArchived(
  id: string,
  archived: boolean
): Promise<OrderView> {
  const stripe = await requireStripe()
  const pi = await stripe.paymentIntents.retrieve(id)

  const updated = await stripe.paymentIntents.update(id, {
    metadata: {
      ...pi.metadata,
      archived: archived ? "true" : "",
    },
  })

  const catalogMap = await getCatalogMap()
  return toOrderView(updated, catalogMap)
}

export async function refundOrder(
  id: string,
  { amount }: { amount?: number } = {}
): Promise<Stripe.Refund> {
  const stripe = await requireStripe()
  return stripe.refunds.create({
    payment_intent: id,
    ...(amount !== undefined ? { amount } : {}),
  })
}

export async function cancelOrder(
  id: string,
  { refund }: { refund: boolean }
): Promise<OrderView> {
  const stripe = await requireStripe()

  if (refund) {
    await stripe.refunds.create({ payment_intent: id })
  }

  const pi = await stripe.paymentIntents.retrieve(id)
  const updated = await stripe.paymentIntents.update(id, {
    metadata: {
      ...pi.metadata,
      status_override: "cancelled",
    },
  })

  const catalogMap = await getCatalogMap()
  return toOrderView(updated, catalogMap)
}

export interface EditOrderItem {
  ref: string
  quantity: number
  unitAmount: number
}

export interface EditOrderPayload {
  items: EditOrderItem[]
  discountAmount?: number
}

/**
 * Update order line items and reconcile the Stripe charge.
 *
 * Succeeded PI reconciliation:
 *  - New total LOWER than original: issue a partial refund for the difference.
 *  - New total HIGHER: create a Stripe Invoice for the delta and finalize it
 *    (sends a hosted payment link to the customer). Metadata reflects the
 *    intended totals; an `outstanding_invoice` key records the Invoice id.
 */
export async function updateOrderItems(
  id: string,
  { items, discountAmount = 0 }: EditOrderPayload
): Promise<{ order: OrderView; delta: number }> {
  const stripe = await requireStripe()
  const pi = await stripe.paymentIntents.retrieve(id, {
    expand: ["latest_charge"],
  })

  const subtotal = items.reduce((s, i) => s + i.unitAmount * i.quantity, 0)
  const shippingCost = parseInt(pi.metadata?.shipping ?? "0", 10)
  const newTotal = Math.max(0, subtotal + shippingCost - discountAmount)
  const delta = newTotal - pi.amount
  const linesStr = buildLinesMetadata(items)
  const priorLines = pi.metadata?.lines ?? ""

  const baseMetadata: Record<string, string> = {
    ...(pi.metadata as Record<string, string>),
    lines: linesStr,
    subtotal: String(subtotal),
  }

  // Freeze checkout composition on the first edit that changes lines.
  // Never overwrite after that so "original" always means the placed order.
  if (!baseMetadata.original_lines && priorLines && priorLines !== linesStr) {
    baseMetadata.original_lines = priorLines
    if (pi.metadata?.subtotal) {
      baseMetadata.original_subtotal = pi.metadata.subtotal
    }
    baseMetadata.edited_at = String(Math.floor(Date.now() / 1000))
  }

  if (delta < 0) {
    const diff = pi.amount - newTotal
    await stripe.refunds.create({
      payment_intent: id,
      amount: diff,
      metadata: {
        reason: "order_edit",
        lines_before: priorLines.slice(0, 480),
        lines_after: linesStr.slice(0, 480),
      },
    })
  }
  // For delta > 0 (total increased): we record the new intended totals in
  // metadata and mark the delta as outstanding. The admin must collect the
  // additional payment manually or via a separate payment link. We do not
  // attempt to create a Stripe Invoice here because these are guest PIs
  // (no stored payment method or customer object).
  if (delta > 0) {
    baseMetadata.outstanding_delta = String(delta)
  } else {
    delete baseMetadata.outstanding_delta
  }

  const updated = await stripe.paymentIntents.update(id, {
    metadata: baseMetadata,
  })

  const catalogMap = await getCatalogMap()
  return { order: toOrderView(updated, catalogMap), delta }
}

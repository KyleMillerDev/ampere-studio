import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe/config"
import { StripeNotConfiguredError } from "@/lib/stripe/products"
import {
  getCatalogMap,
  type CatalogMap,
  type CatalogProduct,
} from "@/lib/stripe/catalog"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "Paid"
  | "Shipped"
  | "Complete"
  | "Cancelled"
  | "Disputed"
export type TrackingCarrier = "USPS" | "UPS" | "FEDEX" | "Other"
export type StatusOverride = "shipped" | "complete" | "cancelled"

export interface OrderLineRef {
  ref: string
  quantity: number
}

export interface EnrichedLineItem {
  ref: string
  productId: string | null
  name: string
  slug: string | null
  image: string | null
  quantity: number
  unitAmount: number | null
  lineTotal: number | null
}

export interface OrderView {
  id: string
  confirmationNumber: string
  amount: number
  currency: string
  status: OrderStatus
  created: number
  customerEmail: string | null
  customerName: string | null
  shipping: Stripe.PaymentIntent["shipping"] | null
  lineItems: EnrichedLineItem[]
  subtotal: number | null
  shippingCost: number | null
  tracking: string | null
  trackingCarrier: TrackingCarrier | null
  shippedAt: number | null
  statusOverride: StatusOverride | null
  rawMetadata: Record<string, string>
  hasDispute: boolean
  isRefunded: boolean
  refundedAmount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Customer-facing confirmation number = last 12 chars of PI id, uppercased. */
export function confirmationNumber(piId: string): string {
  return piId.slice(-12).toUpperCase()
}

/** Parse metadata.lines into ref/quantity pairs. */
export function parseLineMetadata(lines: string | undefined): OrderLineRef[] {
  if (!lines) return []
  return lines
    .split("|")
    .map((entry) => {
      const match = entry.trim().match(/^(.+?)x(\d+)$/i)
      if (!match) return null
      return { ref: match[1].trim(), quantity: parseInt(match[2], 10) }
    })
    .filter((x): x is OrderLineRef => x !== null && x.quantity > 0)
}

/**
 * Rebuild the metadata.lines string from enriched items.
 * Uses product id as the ref, capped at 480 chars.
 */
export function buildLinesMetadata(
  items: Array<{ ref: string; quantity: number }>
): string {
  const parts = items.map((i) => `${i.ref}x${i.quantity}`)
  let result = parts.join("|")
  if (result.length > 480) {
    result = result.slice(0, 480)
    const lastPipe = result.lastIndexOf("|")
    if (lastPipe > 0) result = result.slice(0, lastPipe)
  }
  return result
}

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

/**
 * Derive the display status for a succeeded PaymentIntent.
 * Priority: Disputed > Cancelled > Complete > Shipped > Paid
 */
export function deriveOrderStatus(
  pi: Stripe.PaymentIntent,
  charge: Stripe.Charge | null
): OrderStatus {
  if (hasActiveDispute(charge)) return "Disputed"

  const override = pi.metadata?.status_override as StatusOverride | undefined

  if (override === "cancelled" || isFullyRefunded(charge)) return "Cancelled"
  if (override === "complete") return "Complete"
  if (override === "shipped" || (pi.metadata?.tracking ?? "").length > 0)
    return "Shipped"

  return "Paid"
}

/** Build a carrier tracking URL or null for "Other". */
export function carrierTrackingUrl(
  carrier: TrackingCarrier | null,
  trackingNumber: string
): string | null {
  if (!trackingNumber) return null
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
    case "UPS":
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`
    case "FEDEX":
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
    default:
      return null
  }
}

/** Resolve the latest_charge object (expanded or null). */
function resolveCharge(pi: Stripe.PaymentIntent): Stripe.Charge | null {
  if (!pi.latest_charge) return null
  if (typeof pi.latest_charge === "string") return null
  return pi.latest_charge as Stripe.Charge
}

function toOrderView(
  pi: Stripe.PaymentIntent,
  catalogMap: CatalogMap
): OrderView {
  const charge = resolveCharge(pi)
  const refs = parseLineMetadata(pi.metadata?.lines)
  const lineItems = buildEnrichedOrderItems(refs, catalogMap)
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

  const subtotalStr = pi.metadata?.subtotal
  const subtotal = subtotalStr ? parseInt(subtotalStr, 10) : null

  const shippingCostStr = pi.metadata?.shipping
  const shippingCost = shippingCostStr ? parseInt(shippingCostStr, 10) : null

  const refundedAmount = charge?.amount_refunded ?? 0

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
    subtotal,
    shippingCost,
    tracking,
    trackingCarrier,
    shippedAt,
    statusOverride: (pi.metadata?.status_override as StatusOverride) ?? null,
    rawMetadata: { ...pi.metadata } as Record<string, string>,
    hasDispute: hasActiveDispute(charge),
    isRefunded: isFullyRefunded(charge),
    refundedAmount,
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
    expand: ["data.latest_charge"],
  })) {
    if (pi.status !== "succeeded") continue
    orders.push(toOrderView(pi, catalogMap))
  }

  return orders
}

export async function getStripeOrder(id: string): Promise<OrderView | null> {
  const stripe = await requireStripe()
  const catalogMap = await getCatalogMap()

  try {
    const pi = await stripe.paymentIntents.retrieve(id, {
      expand: ["latest_charge"],
    })
    if (pi.status !== "succeeded") return null
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

  const baseMetadata: Record<string, string> = {
    ...(pi.metadata as Record<string, string>),
    lines: linesStr,
    subtotal: String(subtotal),
  }

  if (delta < 0) {
    const diff = pi.amount - newTotal
    await stripe.refunds.create({ payment_intent: id, amount: diff })
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

/**
 * Client-safe Stripe order types and pure helpers.
 *
 * Keep this module free of next/headers, Amplify server APIs, and Stripe SDK
 * clients so Client Components can import display helpers without pulling
 * server-only code into the browser bundle.
 */

import type Stripe from "stripe"

export type OrderStatus =
  | "Paid"
  | "Shipped"
  | "Complete"
  | "Cancelled"
  | "Refunded"
  | "Partially Refunded"
  | "Disputed"
  | "Failed"
  | "Abandoned"
  | "Checking out"

/**
 * Status filter options. "Archived" is filter-only (not a derived PI status);
 * archived orders keep their real fulfillment status.
 */
export type OrderStatusFilter = OrderStatus | "Archived"

/** Statuses / filter options hidden unless explicitly selected. */
export const OPT_IN_ORDER_STATUS_FILTERS: readonly OrderStatusFilter[] = [
  "Archived",
  "Abandoned",
  "Checking out",
] as const

/** Incomplete checkouts older than this are shown as Abandoned. */
export const CHECKOUT_ABANDON_SECONDS = 15 * 60
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
  /** From product.metadata.part_number when set. */
  partNumber: string | null
  image: string | null
  quantity: number
  unitAmount: number | null
  lineTotal: number | null
}

/** Display label: "PART - Name" when a part number exists, else the product name. */
export function formatOrderProductName(
  name: string,
  partNumber: string | null | undefined
): string {
  if (!partNumber) return name
  return `${partNumber} - ${name}`
}

export interface OrderRefund {
  id: string
  amount: number
  created: number
  status: string
  reason: string | null
}

/**
 * Normalized payment method for list/detail display (Stripe-style).
 * Cards show brand + last4; wallets/APMs show a friendly label.
 */
export interface OrderPaymentMethod {
  /** Stripe payment_method_details.type, e.g. "card", "link", "amazon_pay". */
  type: string
  /** Card brand or wallet key used for icons, e.g. "visa", "mastercard", "link". */
  brand: string | null
  last4: string | null
  /** User-facing text: "•••• 4242" or "Link" / "Amazon Pay". */
  label: string
}

/** User-facing timeline kinds derived from the PaymentIntent / charge. */
export type OrderHistoryKind =
  | "payment_started"
  | "pending_verification"
  | "payment_processing"
  | "payment_authorized"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "refund"
  | "edited"
  | "shipped"
  | "disputed"

export interface OrderHistoryEvent {
  id: string
  kind: OrderHistoryKind
  label: string
  /** Unix seconds. */
  created: number
}

/** Diff row comparing checkout (original) quantities to current lines. */
export interface OrderLineChange {
  ref: string
  productId: string | null
  name: string
  slug: string | null
  partNumber: string | null
  image: string | null
  unitAmount: number | null
  /** Quantity at checkout / before first edit. Null when the line was added later. */
  originalQuantity: number | null
  /** Quantity after edits. Null when the line was removed. */
  currentQuantity: number | null
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
  /** Checkout line items frozen on first edit; empty when never edited. */
  originalLineItems: EnrichedLineItem[]
  subtotal: number | null
  /** Checkout subtotal frozen on first edit. */
  originalSubtotal: number | null
  shippingCost: number | null
  tracking: string | null
  trackingCarrier: TrackingCarrier | null
  shippedAt: number | null
  /** Unix seconds when the order was first edited (if recorded). */
  editedAt: number | null
  statusOverride: StatusOverride | null
  /** True when metadata.archived === "true" (hidden from default list). */
  archived: boolean
  rawMetadata: Record<string, string>
  hasDispute: boolean
  /** True when the charge is fully refunded. */
  isRefunded: boolean
  /** True when some (but not all) of the charge has been refunded. */
  isPartiallyRefunded: boolean
  /** Total refunded in cents (sum of all refunds). */
  refundedAmount: number
  /** Net amount retained after refunds (cents). */
  netAmount: number
  /** Individual Stripe refunds, newest first when available. */
  refunds: OrderRefund[]
  /** User-facing payment / fulfillment timeline, newest first. */
  history: OrderHistoryEvent[]
  /** From latest_charge.payment_method_details; null when unavailable. */
  paymentMethod: OrderPaymentMethod | null
}

/** Net amount kept after refunds (never negative). */
export function orderNetAmount(amount: number, refundedAmount: number): number {
  return Math.max(0, amount - refundedAmount)
}

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

/** True when two line lists differ by ref or quantity. */
export function orderLineQuantitiesDiffer(
  a: EnrichedLineItem[],
  b: EnrichedLineItem[]
): boolean {
  if (a.length !== b.length) return true
  const mapB = new Map(b.map((item) => [item.ref, item.quantity]))
  for (const item of a) {
    if (mapB.get(item.ref) !== item.quantity) return true
  }
  return false
}

/**
 * Merge original (checkout) and current line items into a change list.
 * Returns null when there is no original snapshot or no quantity differences.
 */
export function buildOrderLineChanges(
  original: EnrichedLineItem[],
  current: EnrichedLineItem[]
): OrderLineChange[] | null {
  if (original.length === 0) return null
  if (!orderLineQuantitiesDiffer(original, current)) return null

  const byRef = new Map<string, OrderLineChange>()

  for (const item of original) {
    byRef.set(item.ref, {
      ref: item.ref,
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      partNumber: item.partNumber,
      image: item.image,
      unitAmount: item.unitAmount,
      originalQuantity: item.quantity,
      currentQuantity: null,
    })
  }

  for (const item of current) {
    const existing = byRef.get(item.ref)
    if (existing) {
      existing.currentQuantity = item.quantity
      // Prefer current enrichment (name/image may have improved).
      existing.name = item.name
      existing.image = item.image ?? existing.image
      existing.unitAmount = item.unitAmount ?? existing.unitAmount
      existing.productId = item.productId ?? existing.productId
      existing.slug = item.slug ?? existing.slug
      existing.partNumber = item.partNumber ?? existing.partNumber
    } else {
      byRef.set(item.ref, {
        ref: item.ref,
        productId: item.productId,
        name: item.name,
        slug: item.slug,
        partNumber: item.partNumber,
        image: item.image,
        unitAmount: item.unitAmount,
        originalQuantity: null,
        currentQuantity: item.quantity,
      })
    }
  }

  // Current items first (stable order), then removed originals.
  const currentRefs = new Set(current.map((i) => i.ref))
  const ordered: OrderLineChange[] = []
  for (const item of current) {
    const row = byRef.get(item.ref)
    if (row) ordered.push(row)
  }
  for (const item of original) {
    if (!currentRefs.has(item.ref)) {
      const row = byRef.get(item.ref)
      if (row) ordered.push(row)
    }
  }
  return ordered
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

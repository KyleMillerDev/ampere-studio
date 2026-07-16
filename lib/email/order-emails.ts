import type { ClientRecord } from "@/lib/cms/clients"
import type { OrderView } from "@/lib/stripe/orders"
import { carrierTrackingUrl } from "@/lib/stripe/orders"
import { sendEmail } from "@/lib/email/ses"
import { formatStripeAmount } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Color / branding helpers
// ---------------------------------------------------------------------------

/** Parse a hex string to RGB components. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "")
  if (clean.length !== 3 && clean.length !== 6) return null
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** Relative luminance per WCAG 2.x. */
function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Returns "#ffffff" or "#000000" depending on which has better contrast
 * against the given hex background.
 */
function contrastTextColor(bgHex: string): "#ffffff" | "#000000" {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return "#ffffff"
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b)
  return lum > 0.179 ? "#000000" : "#ffffff"
}

// ---------------------------------------------------------------------------
// Shared layout helpers
// ---------------------------------------------------------------------------

function emailShell(client: ClientRecord, bodyContent: string): string {
  const primaryColor = client.primary_color ?? "#111111"
  const textColor = contrastTextColor(primaryColor)
  const logoUrl = client.logo_url

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${client.name}" style="max-width:160px;max-height:60px;object-fit:contain;display:block;" />`
    : `<span style="font-size:18px;font-weight:700;color:${textColor};">${client.name}</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Order from ${client.name}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:${primaryColor};padding:24px 32px;">
            ${logoHtml}
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${bodyContent}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #e8e8e8;text-align:center;">
            <p style="margin:0;font-size:12px;color:#888;">&copy; ${new Date().getFullYear()} ${client.name}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function lineItemsTable(order: OrderView): string {
  if (order.lineItems.length === 0) return ""

  const rows = order.lineItems
    .map((item) => {
      const imgHtml = item.image
        ? `<img src="${item.image}" alt="${item.name}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #e8e8e8;" />`
        : `<div style="width:48px;height:48px;background:#f0f0f0;border-radius:4px;"></div>`
      const price =
        item.unitAmount !== null
          ? formatStripeAmount(item.unitAmount, order.currency)
          : "—"
      const lineTotal =
        item.lineTotal !== null
          ? formatStripeAmount(item.lineTotal, order.currency)
          : "—"
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">${imgHtml}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#222;">${item.name}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#555;text-align:center;">×${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#555;text-align:right;">${price}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:#222;text-align:right;">${lineTotal}</td>
      </tr>`
    })
    .join("")

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr>
        <th style="padding:8px;font-size:12px;color:#888;text-align:left;border-bottom:1px solid #e8e8e8;"></th>
        <th style="padding:8px;font-size:12px;color:#888;text-align:left;border-bottom:1px solid #e8e8e8;">Item</th>
        <th style="padding:8px;font-size:12px;color:#888;text-align:center;border-bottom:1px solid #e8e8e8;">Qty</th>
        <th style="padding:8px;font-size:12px;color:#888;text-align:right;border-bottom:1px solid #e8e8e8;">Unit</th>
        <th style="padding:8px;font-size:12px;color:#888;text-align:right;border-bottom:1px solid #e8e8e8;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

function totalsBlock(order: OrderView): string {
  const subtotal =
    order.subtotal !== null
      ? formatStripeAmount(order.subtotal, order.currency)
      : "—"
  const shipping =
    order.shippingCost !== null
      ? formatStripeAmount(order.shippingCost, order.currency)
      : "—"
  const total = formatStripeAmount(order.amount, order.currency)

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <td style="font-size:14px;color:#555;padding:4px 0;">Subtotal</td>
      <td style="font-size:14px;color:#222;text-align:right;padding:4px 0;">${subtotal}</td>
    </tr>
    <tr>
      <td style="font-size:14px;color:#555;padding:4px 0;">Shipping</td>
      <td style="font-size:14px;color:#222;text-align:right;padding:4px 0;">${shipping}</td>
    </tr>
    <tr>
      <td style="font-size:15px;font-weight:700;color:#111;padding:8px 0 4px;border-top:1px solid #e8e8e8;">Order total</td>
      <td style="font-size:15px;font-weight:700;color:#111;text-align:right;padding:8px 0 4px;border-top:1px solid #e8e8e8;">${total}</td>
    </tr>
  </table>`
}

function shippingBlock(order: OrderView): string {
  const addr = order.shipping?.address
  if (!addr) return ""
  const lines = [
    order.shipping?.name,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .join("<br />")

  return `<div style="margin:16px 0;">
    <p style="font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Ship to</p>
    <p style="font-size:14px;color:#222;line-height:1.6;margin:0;">${lines}</p>
  </div>`
}

// ---------------------------------------------------------------------------
// Shipment notification
// ---------------------------------------------------------------------------

export interface SendShipmentNotificationParams {
  order: OrderView
  client: ClientRecord
  dashboardOrigin: string
}

export async function sendShipmentNotification({
  order,
  client,
  dashboardOrigin: _dashboardOrigin,
}: SendShipmentNotificationParams): Promise<void> {
  if (!order.customerEmail) return

  const primaryColor = client.primary_color ?? "#111111"
  const textColor = contrastTextColor(primaryColor)
  const carrier = order.trackingCarrier
  const tracking = order.tracking ?? ""
  const trackingUrl = carrierTrackingUrl(carrier, tracking)

  const trackingHtml = trackingUrl
    ? `<a href="${trackingUrl}" style="color:${primaryColor};font-weight:600;">${tracking}</a> (${carrier})`
    : tracking
      ? `${tracking}${carrier && carrier !== "Other" ? ` (${carrier})` : ""}`
      : "—"

  const lookupPath = client.order_lookup_path ?? "/orders/lookup"
  const lookupBase = (client.domain ?? "").replace(/\/$/, "")
  const lookupUrl = `${lookupBase}${lookupPath}?order_number=${encodeURIComponent(order.id)}&order_email=${encodeURIComponent(order.customerEmail)}`

  const itemsHtml = lineItemsTable(order)

  const body = `
    <h2 style="font-size:20px;color:#111;margin:0 0 8px;">Your order has shipped!</h2>
    <p style="font-size:14px;color:#555;margin:0 0 24px;">
      Hi ${order.customerName ?? "there"}, good news. Order <strong>#${order.confirmationNumber}</strong> is on its way.
    </p>

    ${itemsHtml}

    <div style="background:#f9f9f9;border-radius:6px;padding:16px;margin:24px 0;">
      <p style="font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Tracking</p>
      <p style="font-size:14px;color:#222;margin:0;">${trackingHtml}</p>
    </div>

    ${shippingBlock(order)}

    <div style="margin:32px 0;text-align:center;">
      <a href="${lookupUrl}"
        style="display:inline-block;background:${primaryColor};color:${textColor};text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;">
        View order status
      </a>
    </div>

    <p style="font-size:13px;color:#888;margin:0;">
      You can also track your order at:<br />
      <a href="${lookupUrl}" style="color:${primaryColor};word-break:break-all;">${lookupUrl}</a>
    </p>
  `

  const html = emailShell(client, body)

  await sendEmail({
    to: order.customerEmail,
    subject: `Your order has shipped — #${order.confirmationNumber}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Receipt email
// ---------------------------------------------------------------------------

export interface SendReceiptEmailParams {
  order: OrderView
  client: ClientRecord
  to: string
  bcc?: string[]
}

export async function sendReceiptEmail({
  order,
  client,
  to,
  bcc = [],
}: SendReceiptEmailParams): Promise<void> {
  const primaryColor = client.primary_color ?? "#111111"

  const itemsHtml = lineItemsTable(order)
  const totalsHtml = totalsBlock(order)
  const shippingHtml = shippingBlock(order)

  const body = `
    <h2 style="font-size:20px;color:#111;margin:0 0 8px;">Order receipt</h2>
    <p style="font-size:14px;color:#555;margin:0 0 24px;">
      Here is your receipt for order <strong>#${order.confirmationNumber}</strong> placed on
      ${new Date(order.created * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
    </p>

    ${itemsHtml}
    ${totalsHtml}
    ${shippingHtml}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e8e8e8;">
      <p style="font-size:13px;color:#888;margin:0;">
        Order ID: <span style="color:#555;">${order.id}</span><br />
        Confirmation: <span style="color:#555;">#${order.confirmationNumber}</span>
      </p>
    </div>
  `

  const html = emailShell(client, body)

  await sendEmail({
    to,
    bcc: bcc.length > 0 ? bcc : undefined,
    subject: `Order receipt — #${order.confirmationNumber} from ${client.name}`,
    html,
  })
}

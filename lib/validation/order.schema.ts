import { z } from "zod"

export const trackingCarrierSchema = z.enum(["USPS", "UPS", "FEDEX", "Other"])
export type TrackingCarrierInput = z.infer<typeof trackingCarrierSchema>

export const addTrackingSchema = z.object({
  tracking: z.string().min(1, "Tracking number is required"),
  tracking_carrier: trackingCarrierSchema,
  notify_customer: z.boolean().default(true),
})
export type AddTrackingInput = z.infer<typeof addTrackingSchema>

export const statusOverrideSchema = z.enum([
  "shipped",
  "complete",
  "cancelled",
  "",
])
export type StatusOverrideInput = z.infer<typeof statusOverrideSchema>

export const setStatusSchema = z.object({
  status_override: statusOverrideSchema,
})
export type SetStatusInput = z.infer<typeof setStatusSchema>

export const refundOrderSchema = z.object({
  amount: z.number().int().positive().optional(),
})
export type RefundOrderInput = z.infer<typeof refundOrderSchema>

export const cancelOrderSchema = z.object({
  refund: z.boolean().default(true),
})
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>

export const sendReceiptSchema = z.object({
  to: z.string().email("Invalid recipient email"),
  bcc: z.array(z.string().email("Invalid BCC email")).default([]),
})
export type SendReceiptInput = z.infer<typeof sendReceiptSchema>

export const editOrderItemSchema = z.object({
  ref: z.string().min(1),
  quantity: z.number().int().positive(),
  unitAmount: z.number().int().nonnegative(),
})

export const editOrderItemsSchema = z.object({
  items: z.array(editOrderItemSchema).min(1, "At least one item is required"),
  discountAmount: z.number().int().nonnegative().default(0),
})
export type EditOrderItemsInput = z.infer<typeof editOrderItemsSchema>

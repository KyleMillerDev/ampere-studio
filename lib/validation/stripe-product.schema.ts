import { z } from "zod"

/** Stripe allows at most 8 images per product. */
export const STRIPE_MAX_IMAGES = 8

const metadataSchema = z.record(z.string().max(40), z.string().max(500))

export const stripePriceCreateSchema = z.object({
  currency: z
    .string()
    .length(3, "Use a 3-letter currency code")
    .transform((v) => v.toLowerCase()),
  /** Amount in the currency's minor unit (cents for USD). */
  unitAmount: z.number().int().positive("Amount must be greater than zero"),
  type: z.enum(["one_time", "recurring"]).default("one_time"),
  interval: z.enum(["day", "week", "month", "year"]).optional(),
  intervalCount: z.number().int().min(1).max(52).optional(),
  nickname: z.string().max(200).optional(),
})

export const stripeProductCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(250),
  description: z.string().max(5000).default(""),
  active: z.boolean().default(true),
  images: z.array(z.url()).max(STRIPE_MAX_IMAGES).default([]),
  metadata: metadataSchema.default({}),
  /** Optional initial price created alongside the product as its default price. */
  defaultPrice: stripePriceCreateSchema.optional(),
})

export const stripeProductUpdateSchema = z.object({
  name: z.string().min(1).max(250).optional(),
  description: z.string().max(5000).optional(),
  active: z.boolean().optional(),
  images: z.array(z.url()).max(STRIPE_MAX_IMAGES).optional(),
  metadata: metadataSchema.optional(),
  defaultPriceId: z.string().optional(),
})

export const stripePriceUpdateSchema = z.object({
  active: z.boolean(),
})

export type StripePriceCreateInput = z.output<typeof stripePriceCreateSchema>
export type StripeProductCreateInput = z.output<
  typeof stripeProductCreateSchema
>
export type StripeProductFormInput = z.input<typeof stripeProductCreateSchema>
export type StripeProductUpdateInput = z.output<
  typeof stripeProductUpdateSchema
>

/** Serializable view of a Stripe price for client components. */
export interface StripePriceView {
  id: string
  active: boolean
  currency: string
  unitAmount: number | null
  type: "one_time" | "recurring"
  interval?: "day" | "week" | "month" | "year"
  intervalCount?: number
  nickname?: string
  created: number
  isDefault: boolean
}

/** Serializable view of a Stripe product for client components. */
export interface StripeProductView {
  id: string
  name: string
  description: string
  active: boolean
  images: string[]
  metadata: Record<string, string>
  defaultPriceId: string | null
  defaultPrice: StripePriceView | null
  created: number
  updated: number
}

/** Distinct metadata values keyed by metadata field name, used for autofill. */
export type MetadataSuggestions = Record<string, string[]>

import { z } from "zod"

import {
  stripePriceCreateSchema,
  stripePriceUpdateSchema,
  stripeProductCreateSchema,
  stripeProductUpdateSchema,
} from "@/lib/validation/stripe-product.schema"

/** Same product shape as Stripe. `defaultPrice` stays optional. */
export const ampereProductCreateSchema = stripeProductCreateSchema

export const amperePriceCreateSchema = stripePriceCreateSchema

export const amperePriceUpdateSchema = stripePriceUpdateSchema

/** `null` clears the default price so the product can be saved without one. */
export const ampereProductUpdateSchema = stripeProductUpdateSchema.extend({
  defaultPriceId: z.string().min(1).nullable().optional(),
})

export type AmpereProductCreateInput = z.output<
  typeof ampereProductCreateSchema
>
export type AmpereProductUpdateInput = z.output<
  typeof ampereProductUpdateSchema
>

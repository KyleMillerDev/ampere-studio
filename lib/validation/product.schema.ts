import { z } from "zod"

export const productCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).default(""),
  /** Price stored as integer cents. Nonnegative. */
  priceCents: z.number().int().nonnegative(),
  sku: z.string().max(100).default(""),
  inventory: z.number().int().nonnegative().default(0),
  categoryId: z.string().max(200).optional(),
  imageIds: z.array(z.string()).default([]),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
})

export const productUpdateSchema = productCreateSchema.partial()

/** Input shape (what the form captures before defaults apply). */
export type ProductFormInput = z.input<typeof productCreateSchema>
/** Output shape (after defaults + transforms). This is what hits the API. */
export type ProductCreateInput = z.output<typeof productCreateSchema>
export type ProductUpdateInput = z.output<typeof productUpdateSchema>

export interface Product extends ProductCreateInput {
  id: string
  client_id: string
  createdAt: string
  updatedAt: string
}

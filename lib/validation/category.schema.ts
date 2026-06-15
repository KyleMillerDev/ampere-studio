import { z } from "zod"

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(1000).default(""),
  parentCategoryId: z.string().max(200).optional(),
  sortOrder: z.number().int().default(0),
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

export type CategoryFormInput = z.input<typeof categoryCreateSchema>
export type CategoryCreateInput = z.output<typeof categoryCreateSchema>
export type CategoryUpdateInput = z.output<typeof categoryUpdateSchema>

export interface Category extends CategoryCreateInput {
  id: string
  client_id: string
  createdAt: string
  updatedAt: string
}

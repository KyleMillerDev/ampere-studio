import { z } from "zod"

// ─── Shared primitives ────────────────────────────────────────────────────────

export const moneySchema = z.object({
  amount: z
    .number()
    .int()
    .nonnegative("Price must be a non-negative integer (cents)"),
  currency: z.literal("USD"),
})

// ─── Limits ───────────────────────────────────────────────────────────────────

export const VARIATION_LIMIT = 250
export const OPTION_LIMIT = 6
export const OPTION_VALUE_LIMIT = 500
export const MODIFIER_LIST_LIMIT = 10
export const MODIFIER_VALUE_LIMIT = 100
export const NAME_MAX = 512
export const DESCRIPTION_MAX = 65535

// ─── Item Option ──────────────────────────────────────────────────────────────

export const itemOptionValueSchema = z.object({
  id: z.string().optional(),
  item_option_value_data: z.object({
    item_option_id: z.string().optional(),
    name: z
      .string()
      .min(1, "Option value name is required")
      .max(255, "Option value name too long"),
    ordinal: z.number().int().optional(),
    km_markup: z
      .number()
      .min(-10000, "Markup cannot be less than -$10,000")
      .max(10000, "Markup cannot exceed $10,000")
      .optional(),
  }),
})

export const itemOptionSchema = z.object({
  id: z.string().optional(),
  item_option_data: z.object({
    name: z
      .string()
      .min(1, "Option name is required")
      .max(NAME_MAX, "Option name too long"),
    display_name: z.string().max(NAME_MAX).optional(),
    show_colors: z.boolean().optional(),
    values: z
      .array(itemOptionValueSchema)
      .min(1, "Each option must have at least one value")
      .max(
        OPTION_VALUE_LIMIT,
        `Each option can have at most ${OPTION_VALUE_LIMIT} values`
      ),
  }),
})

export const optionPresetSchema = z.object({
  name: z.string().min(1, "Preset name is required").max(NAME_MAX),
  option: itemOptionSchema,
})

// ─── Modifier ─────────────────────────────────────────────────────────────────

export const modifierSchema = z.object({
  name: z.string().min(1, "Modifier name is required").max(255),
  price_cents: z
    .number()
    .int()
    .nonnegative("Modifier price must be non-negative")
    .optional(),
  ordinal: z.number().int().optional(),
})

export const modifierListSchema = z.object({
  name: z.string().min(1, "Modifier list name is required").max(NAME_MAX),
  selection_type: z.enum(["SINGLE", "MULTIPLE"]),
  modifiers: z
    .array(modifierSchema)
    .min(1, "Modifier list must have at least one modifier")
    .max(
      MODIFIER_VALUE_LIMIT,
      `Modifier list can have at most ${MODIFIER_VALUE_LIMIT} modifiers`
    ),
})

// ─── Create Product ───────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(NAME_MAX),
  price: z
    .number()
    .int("Price must be in cents (integer)")
    .nonnegative("Price must be non-negative")
    .max(99999999, "Price cannot exceed $999,999.99"),
  description_html: z.string().max(DESCRIPTION_MAX).optional(),
  image_urls: z.array(z.string().url("Invalid image URL")).max(50).optional(),
  category_ids: z.array(z.string()).max(50).optional(),
  status: z.enum(["Published", "Draft"]),
  available_online: z.boolean().optional(),
  available_from_date: z.string().optional(),
  available_until_date: z.string().optional(),
  allow_product_note: z.boolean().optional(),
  allow_product_personalization: z.boolean().optional(),
  allowed_fulfillments: z.string().optional(),
  options: z
    .array(itemOptionSchema)
    .max(
      OPTION_LIMIT,
      `Products can have at most ${OPTION_LIMIT} option dimensions`
    )
    .optional(),
  modifier_list_ids: z.array(z.string()).max(MODIFIER_LIST_LIMIT).optional(),
  modifiers: z.array(modifierListSchema).max(MODIFIER_LIST_LIMIT).optional(),
  km_markups: z.record(z.string(), z.number()).optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial().extend({
  existing_options: z.array(itemOptionSchema).optional(),
})

export type UpdateProductInput = z.infer<typeof updateProductSchema>

// ─── Category ─────────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(NAME_MAX),
  image_url: z.string().url("Invalid image URL").optional().or(z.literal("")),
  description_html: z.string().max(DESCRIPTION_MAX).optional(),
  order_deadline: z.string().optional(),
  status: z.enum(["Published", "Draft", "Featured"]),
  available_online: z.boolean().optional(),
  available_from_date: z.string().optional(),
  available_until_date: z.string().optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export const updateCategorySchema = createCategorySchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

// ─── Discount ─────────────────────────────────────────────────────────────────

export const createDiscountSchema = z
  .object({
    name: z.string().min(1, "Discount name is required").max(NAME_MAX),
    discount: z.union([
      z.object({
        percentage: z
          .number()
          .min(0.01)
          .max(100, "Percentage cannot exceed 100%"),
      }),
      z.object({
        amount: z
          .number()
          .int()
          .nonnegative("Discount amount must be non-negative")
          .max(99999999),
      }),
    ]),
    product_ids: z.array(z.string()).optional(),
    category_ids: z.array(z.string()).optional(),
    pricing_rule: z.object({
      valid_from_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
      valid_until_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
      valid_from_local_time: z
        .string()
        .regex(/^\d{2}:\d{2}:\d{2}$/, "Use HH:MM:SS"),
      valid_until_local_time: z
        .string()
        .regex(/^\d{2}:\d{2}:\d{2}$/, "Use HH:MM:SS"),
    }),
  })
  .refine(
    (data) =>
      (data.product_ids && data.product_ids.length > 0) ||
      (data.category_ids && data.category_ids.length > 0),
    { message: "Discount must target at least one product or category" }
  )

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>

// ─── Order fulfillment ────────────────────────────────────────────────────────

export const updateFulfillmentSchema = z.object({
  uid: z.string(),
  state: z.enum([
    "PROPOSED",
    "RESERVED",
    "PREPARED",
    "COMPLETED",
    "CANCELED",
    "FAILED",
  ]),
  tracking_number: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
})

export type UpdateFulfillmentInput = z.infer<typeof updateFulfillmentSchema>

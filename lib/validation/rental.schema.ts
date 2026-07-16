import { z } from "zod"

export const PROPERTY_TYPES = [
  "single-family",
  "land",
  "farm",
  "commercial",
  "multi-family",
  "condo",
  "townhouse",
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  active: "For Rent",
  rented: "Rented",
}

const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers, and hyphens"
  )

const addressSchema = z.object({
  street: z.string().min(1, "Street is required").max(300),
  city: z.string().min(1, "City is required").max(100),
  state: z
    .string()
    .length(2, "State must be a 2-letter code")
    .regex(/^[A-Za-z]{2}$/, "State must be 2 letters")
    .transform((v) => v.toUpperCase()),
  zip: z.string().min(1, "ZIP is required").max(20),
})

const agentSchema = z.object({
  name: z.string().min(1, "Agent name is required").max(200),
  phone: z.string().min(1, "Phone is required").max(50),
  email: z.string().email("Valid email required").max(200),
})

export const rentalCreateSchema = z.object({
  slug: slugSchema.optional(),

  status: z.enum(["active", "rented"]).default("active"),

  mlsId: z.string().max(100).nullable().optional().default(null),

  price: z.number().int().nonnegative("Price must be a non-negative integer"),

  address: addressSchema,
  county: z.string().min(1, "County is required").max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),

  beds: z.number().int().nonnegative(),
  baths: z.number().nonnegative(),
  halfBaths: z.number().int().nonnegative().default(0),
  sqft: z.number().int().nonnegative(),
  lotSizeAcres: z.number().nonnegative().default(0),
  yearBuilt: z.number().int().nonnegative().default(0),
  propertyType: z.enum(PROPERTY_TYPES),
  garageSpaces: z.number().int().nonnegative().default(0),
  stories: z.number().int().nonnegative().default(1),
  hoaFee: z.number().nonnegative().default(0),
  propertyTax: z.number().nonnegative().default(0),
  daysOnMarket: z.number().int().nonnegative().default(0),

  listedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Listed date must be YYYY-MM-DD"),
  description: z.string().min(1, "Description is required").max(10000),
  features: z.array(z.string().max(200)).default([]),
  images: z.array(z.string().min(1)).default([]),

  agent: agentSchema,
})

export const rentalUpdateSchema = rentalCreateSchema
  .omit({ slug: true })
  .partial()

export type RentalFormInput = z.input<typeof rentalCreateSchema>
export type RentalCreateInput = z.output<typeof rentalCreateSchema>
export type RentalUpdateInput = z.output<typeof rentalUpdateSchema>

/**
 * Full record shape as stored in DynamoDB — exactly the contract the tenant
 * websites read. `id`, `client_id`, and `updatedAt` are server-attached and
 * never part of the create/update input.
 */
export interface RentalRecord extends RentalCreateInput {
  id: string
  client_id: string
  slug: string
  updatedAt: string
}

/** Derive a URL-safe slug from an address (street + city). */
export function addressToSlug(address: {
  street: string
  city: string
}): string {
  return `${address.street} ${address.city}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180)
}

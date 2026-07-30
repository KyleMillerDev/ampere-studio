import { z } from "zod"

import { RENTAL_COUNTIES } from "@/lib/constants/rental-counties"

export const PROPERTY_TYPES = [
  "single-family",
  "commercial",
  "multi-family",
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

const PROPERTY_TYPE_ALIASES: Record<string, PropertyType> = {
  "single-family": "single-family",
  "single family": "single-family",
  singlefamily: "single-family",
  "multi-family": "multi-family",
  "multi family": "multi-family",
  multifamily: "multi-family",
  commercial: "commercial",
  condo: "single-family",
  condominium: "single-family",
  townhouse: "single-family",
  townhome: "single-family",
  land: "single-family",
  farm: "single-family",
}

/** Map stored or human-readable values to the canonical property type slug. */
export function normalizePropertyType(
  value: string | undefined | null,
  fallback: PropertyType = "single-family"
): PropertyType {
  if (!value) return fallback

  const trimmed = value.trim()
  if ((PROPERTY_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed as PropertyType
  }

  const lower = trimmed.toLowerCase()
  const kebab = lower.replace(/\s+/g, "-")
  const spaced = lower.replace(/-/g, " ")

  return (
    PROPERTY_TYPE_ALIASES[trimmed] ??
    PROPERTY_TYPE_ALIASES[lower] ??
    PROPERTY_TYPE_ALIASES[kebab] ??
    PROPERTY_TYPE_ALIASES[spaced] ??
    fallback
  )
}

export function formatPropertyTypeLabel(type: string): string {
  return normalizePropertyType(type)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export { RENTAL_COUNTIES }
export type RentalCounty = (typeof RENTAL_COUNTIES)[number]

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

const optionalEmail = z
  .string()
  .max(200)
  .default("")
  .refine((v) => !v || z.string().email().safeParse(v).success, {
    message: "Valid email required",
  })

const agentSchema = z.object({
  name: z.string().max(200).default(""),
  phone: z.string().max(50).default(""),
  email: optionalEmail,
})

export const rentalCreateSchema = z.object({
  slug: slugSchema.optional(),

  status: z.enum(["active", "rented"]).default("active"),

  mlsId: z.string().max(100).nullable().optional().default(null),

  price: z.number().int().nonnegative("Price must be a non-negative integer"),

  address: addressSchema,
  county: z.enum(RENTAL_COUNTIES, {
    error: "Select a county",
  }),
  lat: z.number().min(-90).max(90).default(0),
  lng: z.number().min(-180).max(180).default(0),

  beds: z.number().int().nonnegative().default(0),
  baths: z.number().nonnegative().default(0),
  halfBaths: z.number().int().nonnegative().default(0),
  sqft: z.number().int().nonnegative().default(0),
  lotSizeAcres: z.number().nonnegative().optional().default(0),
  yearBuilt: z.number().int().nonnegative().optional().default(0),
  propertyType: z.preprocess(
    (value) =>
      normalizePropertyType(typeof value === "string" ? value : undefined),
    z.enum(PROPERTY_TYPES)
  ),
  garageSpaces: z.number().int().nonnegative().default(0),
  stories: z.number().int().nonnegative().default(1),
  hoaFee: z.number().nonnegative().optional().default(0),
  propertyTax: z.number().nonnegative().optional().default(0),
  daysOnMarket: z.number().int().nonnegative().optional().default(0),

  listedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Listed date must be YYYY-MM-DD"),
  description: z.string().max(10000).default(""),
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

/** Derive a URL-safe slug from the street address (e.g. 108-main-st). */
export function addressToSlug(address: { street: string }): string {
  const trimmed = address.street.trim()
  const numbered = trimmed.match(/^(\d+)\s+(.+)$/)

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

  if (numbered) {
    const streetPart = slugify(numbered[2] ?? "")
    if (streetPart) return `${numbered[1]}-${streetPart}`.slice(0, 180)
  }

  return slugify(trimmed).slice(0, 180)
}

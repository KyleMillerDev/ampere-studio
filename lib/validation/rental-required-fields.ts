import type { FieldPath } from "react-hook-form"

import { RENTAL_COUNTIES } from "@/lib/constants/rental-counties"
import {
  PROPERTY_TYPES,
  normalizePropertyType,
  type RentalFormInput,
} from "@/lib/validation/rental.schema"

/** Form fields that must be valid before a rental can be saved. */
export const RENTAL_REQUIRED_FIELDS = [
  "address.street",
  "address.city",
  "address.state",
  "address.zip",
  "county",
  "price",
  "propertyType",
  "listedDate",
] as const satisfies readonly FieldPath<RentalFormInput>[]

export type RentalRequiredField = (typeof RENTAL_REQUIRED_FIELDS)[number]

export function isRentalRequiredField(
  name: FieldPath<RentalFormInput>
): name is RentalRequiredField {
  return (RENTAL_REQUIRED_FIELDS as readonly string[]).includes(name)
}

export function isRentalRequiredFieldSatisfied(
  name: FieldPath<RentalFormInput>,
  values: RentalFormInput
): boolean {
  switch (name) {
    case "address.street":
      return Boolean(values.address?.street?.trim())
    case "address.city":
      return Boolean(values.address?.city?.trim())
    case "address.state":
      return /^[A-Za-z]{2}$/.test(values.address?.state ?? "")
    case "address.zip":
      return Boolean(values.address?.zip?.trim())
    case "county":
      return (
        typeof values.county === "string" &&
        (RENTAL_COUNTIES as readonly string[]).includes(values.county)
      )
    case "price":
      return typeof values.price === "number" && values.price > 0
    case "propertyType":
      return (PROPERTY_TYPES as readonly string[]).includes(
        normalizePropertyType(values.propertyType)
      )
    case "listedDate":
      return /^\d{4}-\d{2}-\d{2}$/.test(values.listedDate ?? "")
    default:
      return true
  }
}

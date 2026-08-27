import { describe, expect, it } from "vitest"

import {
  isRentalRequiredFieldSatisfied,
  RENTAL_REQUIRED_FIELDS,
} from "@/lib/validation/rental-required-fields"
import type { RentalFormInput } from "@/lib/validation/rental.schema"

const freshFormValues = (): RentalFormInput =>
  ({
    status: "active",
    price: 0,
    address: { street: "", city: "", state: "IA", zip: "" },
    county: undefined,
    lat: 0,
    lng: 0,
    beds: 0,
    baths: 0,
    halfBaths: 0,
    sqft: 0,
    propertyType: "single-family",
    garageSpaces: 0,
    stories: 1,
    listedDate: "2026-07-30",
    description: "",
    features: [],
    images: [],
    agent: { name: "", phone: "", email: "" },
  }) as unknown as RentalFormInput

describe("rental-required-fields", () => {
  it("lists every required rental form path", () => {
    expect(RENTAL_REQUIRED_FIELDS).toEqual([
      "address.street",
      "address.city",
      "address.state",
      "address.zip",
      "county",
      "price",
      "propertyType",
      "listedDate",
    ])
  })

  it("treats fields with defaults as satisfied on a fresh form", () => {
    const values = freshFormValues()

    expect(isRentalRequiredFieldSatisfied("address.state", values)).toBe(true)
    expect(isRentalRequiredFieldSatisfied("propertyType", values)).toBe(true)
    expect(isRentalRequiredFieldSatisfied("listedDate", values)).toBe(true)
  })

  it("requires a positive price and selected county", () => {
    const values = {
      ...freshFormValues(),
      address: {
        street: "123 Main St",
        city: "Bloomfield",
        state: "IA",
        zip: "52537",
      },
      county: "Davis" as const,
      price: 1200,
    }

    expect(isRentalRequiredFieldSatisfied("price", values)).toBe(true)
    expect(isRentalRequiredFieldSatisfied("county", values)).toBe(true)
    expect(
      isRentalRequiredFieldSatisfied("price", { ...values, price: 0 })
    ).toBe(false)
  })
})

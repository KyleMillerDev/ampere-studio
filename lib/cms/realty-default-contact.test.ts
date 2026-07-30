import { describe, expect, it } from "vitest"

import { parseRealtyDefaultContact } from "@/lib/cms/realty-default-contact"
import type { ClientRecord } from "@/lib/cms/clients"

describe("parseRealtyDefaultContact", () => {
  it("reads phone_number from the client map", () => {
    const client = {
      client_id: "backhomerealty",
      name: "Back Home Realty",
      realty_default_listing_contact_info: {
        name: "Nolan Stewart",
        email: "nolan@example.com",
        phone_number: "641-242-0542",
      },
    } as ClientRecord

    expect(parseRealtyDefaultContact(client)).toEqual({
      name: "Nolan Stewart",
      email: "nolan@example.com",
      phone: "641-242-0542",
    })
  })

  it("supports legacy phone key variants", () => {
    expect(
      parseRealtyDefaultContact({
        client_id: "demo",
        name: "Demo",
        realty_default_listing_contact_info: {
          name: "A",
          email: "a@example.com",
          "phone number": "555-0100",
        },
      } as ClientRecord).phone
    ).toBe("555-0100")
  })
})

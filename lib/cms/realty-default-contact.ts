import type { ClientRecord } from "@/lib/cms/clients"

export interface RealtyDefaultContact {
  name: string
  phone: string
  email: string
}

function stringField(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return ""
}

function mapField(map: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = stringField(map[key])
    if (value) return value
  }
  return ""
}

/** Defaults for rental listing contact info from the client record. */
export function parseRealtyDefaultContact(
  client: ClientRecord
): RealtyDefaultContact {
  const raw =
    client.realty_default_listing_contact_info ??
    client.realtyDefaultListingContactInfo

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { name: "", phone: "", email: "" }
  }

  const map = raw as Record<string, unknown>

  return {
    name: mapField(map, ["name"]),
    email: mapField(map, ["email"]),
    phone: mapField(map, [
      "phone_number",
      "phone number",
      "phoneNumber",
      "phone",
    ]),
  }
}

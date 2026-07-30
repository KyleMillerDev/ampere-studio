import { getGoogleMapsApiKey } from "@/lib/google/maps-api-key"

export interface GeocodableAddress {
  street: string
  city: string
  state: string
  zip: string
}

export async function geocodeAddress(
  address: GeocodableAddress
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = getGoogleMapsApiKey()
  if (!apiKey) return null

  const query = [
    address.street,
    address.city,
    `${address.state} ${address.zip}`.trim(),
    "USA",
  ]
    .filter(Boolean)
    .join(", ")

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("address", query)
  url.searchParams.set("key", apiKey)

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) return null

  const data = (await res.json()) as {
    status?: string
    results?: Array<{
      geometry?: { location?: { lat?: number; lng?: number } }
    }>
  }

  if (data.status !== "OK") return null

  const location = data.results?.[0]?.geometry?.location
  if (typeof location?.lat !== "number" || typeof location?.lng !== "number") {
    return null
  }

  return { lat: location.lat, lng: location.lng }
}

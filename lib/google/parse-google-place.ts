import {
  RENTAL_COUNTIES,
  type RentalCounty,
} from "@/lib/constants/rental-counties"

export interface ParsedGooglePlace {
  street: string
  city: string
  state: string
  zip: string
  lat: number
  lng: number
  county?: RentalCounty
}

type AddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type PlaceGeometry = {
  location?: {
    lat: () => number
    lng: () => number
  }
}

type PlaceResult = {
  address_components?: AddressComponent[]
  formatted_address?: string
  geometry?: PlaceGeometry
}

function component(
  components: AddressComponent[],
  type: string,
  name: "long_name" | "short_name" = "long_name"
): string {
  return components.find((c) => c.types.includes(type))?.[name] ?? ""
}

/** Strip a trailing "County" suffix from Google administrative_area_level_2 values. */
export function normalizeGoogleCountyName(raw: string): string {
  return raw.replace(/\s+county\s*$/i, "").trim()
}

/** Match a Google county name to a supported rental county, if possible. */
export function matchRentalCounty(raw: string): RentalCounty | undefined {
  const normalized = normalizeGoogleCountyName(raw)
  if (!normalized) return undefined

  return RENTAL_COUNTIES.find(
    (county) => county.toLowerCase() === normalized.toLowerCase()
  )
}

/** Parse a Google Places result into rental address fields. */
export function parseGooglePlace(place: PlaceResult): ParsedGooglePlace | null {
  const components = place.address_components ?? []
  const streetNumber = component(components, "street_number")
  const route = component(components, "route")
  const street =
    [streetNumber, route].filter(Boolean).join(" ") ||
    place.formatted_address?.split(",")[0]?.trim() ||
    ""

  const city =
    component(components, "locality") ||
    component(components, "postal_town") ||
    component(components, "sublocality") ||
    component(components, "administrative_area_level_3")

  const state = component(
    components,
    "administrative_area_level_1",
    "short_name"
  )
  const zip = component(components, "postal_code")
  const countyRaw = component(components, "administrative_area_level_2")
  const county = countyRaw ? matchRentalCounty(countyRaw) : undefined

  const latFn = place.geometry?.location?.lat
  const lngFn = place.geometry?.location?.lng
  if (!street || !city || !state || !zip || !latFn || !lngFn) {
    return null
  }

  return {
    street,
    city,
    state: state.toUpperCase(),
    zip,
    lat: latFn(),
    lng: lngFn(),
    county,
  }
}

/** Common rental amenity tags shown as quick-add suggestions in the listing form. */
export const RENTAL_AMENITY_SUGGESTIONS = [
  "Central Air",
  "Washer & Dryer",
  "Dishwasher",
  "Refrigerator",
  "Hardwood Floors",
  "Pet Friendly",
  "Off-Street Parking",
  "Garage",
  "Fenced Yard",
  "Basement",
  "Fireplace",
  "Updated Kitchen",
  "Stainless Steel Appliances",
  "Deck / Patio",
  "Storage",
  "Utilities Included",
  "Lawn Care Included",
  "Snow Removal",
  "Ceiling Fans",
  "Walk-in Closet",
  "Window Coverings",
  "High-Speed Internet",
  "Smoke-Free",
  "Natural Gas Heat",
  "Electric Heat",
] as const

export function getAvailableAmenitySuggestions(selected: string[]): string[] {
  const selectedLower = new Set(selected.map((tag) => tag.trim().toLowerCase()))
  return RENTAL_AMENITY_SUGGESTIONS.filter(
    (suggestion) => !selectedLower.has(suggestion.toLowerCase())
  )
}

export function hasAmenityTag(selected: string[], tag: string): boolean {
  const lower = tag.trim().toLowerCase()
  return selected.some((existing) => existing.trim().toLowerCase() === lower)
}

/** Iowa counties served by rental listings (name only, no "County" suffix). */
export const RENTAL_COUNTIES = [
  "Davis",
  "Appanoose",
  "Wapello",
  "Van Buren",
  "Monroe",
  "Jefferson",
  "Mahaska",
  "Keokuk",
] as const

export type RentalCounty = (typeof RENTAL_COUNTIES)[number]

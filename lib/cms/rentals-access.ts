import { getActiveClientFeatures } from "@/lib/cms/clients"

export class RentalsDisabledError extends Error {
  constructor() {
    super("Rentals are not enabled for this client.")
    this.name = "RentalsDisabledError"
  }
}

/**
 * Throws RentalsDisabledError when the active client does not have rentals
 * enabled. Call at the top of every rentals API route and page.
 */
export async function assertRentalsEnabled(): Promise<void> {
  const features = await getActiveClientFeatures()
  if (!features.rentals) {
    throw new RentalsDisabledError()
  }
}

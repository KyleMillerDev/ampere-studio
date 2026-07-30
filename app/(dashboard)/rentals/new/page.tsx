import { redirect } from "next/navigation"

import { RentalForm } from "@/components/cms/rental-form"
import { getActiveClient } from "@/lib/cms/clients"
import { parseRealtyDefaultContact } from "@/lib/cms/realty-default-contact"
import {
  assertRentalsEnabled,
  RentalsDisabledError,
} from "@/lib/cms/rentals-access"

export const metadata = { title: "New Rental" }
export const dynamic = "force-dynamic"

export default async function NewRentalPage() {
  try {
    await assertRentalsEnabled()
  } catch (err) {
    if (err instanceof RentalsDisabledError) redirect("/dashboard")
    throw err
  }

  const client = await getActiveClient()
  const defaultContact = parseRealtyDefaultContact(client)

  return (
    <RentalForm
      heading={{
        title: "New rental",
        description:
          "Create a new rental listing. It will be publicly visible on the tenant site once set to For Rent.",
      }}
      defaultContact={defaultContact}
    />
  )
}

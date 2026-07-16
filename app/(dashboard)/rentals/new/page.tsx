import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { RentalForm } from "@/components/cms/rental-form"
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

  return (
    <div className="space-y-6">
      <PageHeading
        title="New rental"
        description="Create a new rental listing. It will be publicly visible on the tenant site once set to For Rent."
      />
      <RentalForm />
    </div>
  )
}

import { notFound, redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { RentalForm } from "@/components/cms/rental-form"
import { getRental } from "@/lib/cms/rentals"
import {
  assertRentalsEnabled,
  RentalsDisabledError,
} from "@/lib/cms/rentals-access"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Ctx) {
  const { id } = await params
  return { title: `Edit Rental – ${id}` }
}

export default async function EditRentalPage({ params }: Ctx) {
  try {
    await assertRentalsEnabled()
  } catch (err) {
    if (err instanceof RentalsDisabledError) redirect("/dashboard")
    throw err
  }

  const { id } = await params
  const rental = await getRental(id)
  if (!rental) notFound()

  return (
    <div className="space-y-6">
      <PageHeading
        title="Edit rental"
        description={`${rental.address.street}, ${rental.address.city} — slug is locked after creation.`}
      />
      <RentalForm initial={rental} />
    </div>
  )
}

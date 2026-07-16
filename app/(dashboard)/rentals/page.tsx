import Link from "next/link"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { RentalsTable } from "@/components/cms/rentals-table"
import { Button } from "@/components/ui/button"
import { listRentals } from "@/lib/cms/rentals"
import {
  assertRentalsEnabled,
  RentalsDisabledError,
} from "@/lib/cms/rentals-access"

export const metadata = { title: "Rentals" }
export const dynamic = "force-dynamic"

export default async function RentalsPage() {
  try {
    await assertRentalsEnabled()
  } catch (err) {
    if (err instanceof RentalsDisabledError) redirect("/dashboard")
    throw err
  }

  const rentals = await listRentals().catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Rentals"
        description="Manage rental listings for this client. Active listings appear on the tenant site."
        actions={
          <Button asChild>
            <Link href="/rentals/new">
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
              New rental
            </Link>
          </Button>
        }
      />
      <RentalsTable rentals={rentals} />
    </div>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareDiscountsTable } from "@/components/cms/square/square-discounts-table"
import { Button } from "@/components/ui/button"
import { isSquareEnabled } from "@/lib/square/config"
import { listSquareDiscounts } from "@/lib/square/discounts"

export const dynamic = "force-dynamic"

export default async function SquareDiscountsPage() {
  const enabled = await isSquareEnabled()
  if (!enabled) redirect("/dashboard")

  const discounts = await listSquareDiscounts().catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Discounts"
        description="Manage automatic Square pricing rules and promotions."
        actions={
          <Button asChild>
            <Link href="/square/discounts/new">
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
              New discount
            </Link>
          </Button>
        }
      />
      <SquareDiscountsTable discounts={discounts} />
    </div>
  )
}

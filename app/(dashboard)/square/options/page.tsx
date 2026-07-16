import Link from "next/link"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareOptionPresetsTable } from "@/components/cms/square/square-option-presets-table"
import { Button } from "@/components/ui/button"
import { isSquareEnabled } from "@/lib/square/config"
import { listOptionPresets } from "@/lib/square/option-templates"

export const dynamic = "force-dynamic"

export default async function SquareOptionPresetsPage() {
  const enabled = await isSquareEnabled()
  if (!enabled) redirect("/dashboard")

  const presets = await listOptionPresets().catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Option templates"
        description="Saved option presets you can load into the product builder to speed up product creation."
        actions={
          <Button asChild>
            <Link href="/square/options/new">
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
              New preset
            </Link>
          </Button>
        }
      />
      <SquareOptionPresetsTable presets={presets} />
    </div>
  )
}

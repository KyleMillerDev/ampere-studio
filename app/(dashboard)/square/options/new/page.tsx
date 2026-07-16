import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareOptionPresetForm } from "@/components/cms/square/square-option-preset-form"
import { isSquareEnabled } from "@/lib/square/config"

export const dynamic = "force-dynamic"

export default async function NewOptionPresetPage() {
  const enabled = await isSquareEnabled()
  if (!enabled) redirect("/square/options")

  return (
    <div className="space-y-6">
      <PageHeading
        title="New option template"
        description="Create a reusable option preset to load into the product builder."
      />
      <SquareOptionPresetForm />
    </div>
  )
}

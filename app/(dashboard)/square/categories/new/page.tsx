import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareCategoryForm } from "@/components/cms/square/square-category-form"
import { isSquareEnabled } from "@/lib/square/config"

export const dynamic = "force-dynamic"

export default async function NewSquareCategoryPage() {
  const enabled = await isSquareEnabled()
  if (!enabled) redirect("/products/categories")

  return (
    <div className="space-y-6">
      <PageHeading
        title="New category"
        description="Create a new product category in your Square catalog."
      />
      <SquareCategoryForm submitLabel="Create category" />
    </div>
  )
}

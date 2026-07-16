import { notFound, redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareCategoryForm } from "@/components/cms/square/square-category-form"
import { isSquareEnabled } from "@/lib/square/config"
import { getSquareCategory } from "@/lib/square/categories"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function EditSquareCategoryPage({ params }: Props) {
  const { id } = await params
  const enabled = await isSquareEnabled()
  if (!enabled) redirect("/products/categories")

  const category = await getSquareCategory(id)
  if (!category) notFound()

  return (
    <div className="space-y-6">
      <PageHeading
        title={`Edit: ${category.category_data.name}`}
        description="Changes are written directly to Square."
      />
      <SquareCategoryForm initial={category} submitLabel="Save changes" />
    </div>
  )
}

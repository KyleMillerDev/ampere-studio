import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { SquareDiscountForm } from "@/components/cms/square/square-discount-form"
import { isSquareEnabled } from "@/lib/square/config"
import { listSquareProducts } from "@/lib/square/products"
import { listSquareCategories } from "@/lib/square/categories"

export const dynamic = "force-dynamic"

export default async function NewSquareDiscountPage() {
  const enabled = await isSquareEnabled()
  if (!enabled) redirect("/square/discounts")

  const [products, categories] = await Promise.all([
    listSquareProducts().catch(() => []),
    listSquareCategories().catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <PageHeading
        title="New discount"
        description="Create an automatic pricing rule in Square. It will apply at checkout."
      />
      <SquareDiscountForm products={products} categories={categories} />
    </div>
  )
}

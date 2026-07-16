import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { CategoryManager } from "@/components/cms/category-manager"
import { SquareCategoriesTable } from "@/components/cms/square/square-categories-table"
import { Button } from "@/components/ui/button"
import { listCategories } from "@/lib/cms/categories"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { isSquareEnabled } from "@/lib/square/config"
import { listSquareCategories } from "@/lib/square/categories"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const catalog = await getActiveCatalogProvider()

  if (catalog === "square") {
    const enabled = await isSquareEnabled()
    if (enabled) {
      const categories = await listSquareCategories().catch(() => [])
      return (
        <div className="space-y-6">
          <PageHeading
            title="Categories"
            description="Organize your Square catalog into categories."
            actions={
              <Button asChild>
                <Link href="/square/categories/new">
                  <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
                  New category
                </Link>
              </Button>
            }
          />
          <SquareCategoriesTable categories={categories} />
        </div>
      )
    }
  }

  const categories = await listCategories().catch(() => [])
  return (
    <div className="space-y-6">
      <PageHeading
        title="Categories"
        description="Organize products into groups customers can browse and filter on your site."
      />
      <CategoryManager categories={categories} />
    </div>
  )
}

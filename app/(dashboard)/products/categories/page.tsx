import { PageHeading } from "@/components/cms/page-heading"
import { CategoryManager } from "@/components/cms/category-manager"
import { listCategories } from "@/lib/cms/categories"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
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

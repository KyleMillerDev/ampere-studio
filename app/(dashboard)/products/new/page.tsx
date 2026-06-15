import { PageHeading } from "@/components/cms/page-heading"
import { ProductForm } from "@/components/cms/product-form"
import { StripeProductForm } from "@/components/cms/stripe/stripe-product-form"
import { listCategories } from "@/lib/cms/categories"
import { getStripeKeys } from "@/lib/stripe/config"
import { getMetadataSuggestions } from "@/lib/stripe/products"

export const dynamic = "force-dynamic"

export default async function NewProductPage() {
  const stripeKeys = await getStripeKeys()

  if (stripeKeys) {
    const suggestions = await getMetadataSuggestions().catch(() => ({}))
    return (
      <div className="space-y-6">
        <PageHeading
          title="New product"
          description="Create a product directly in this client's Stripe account."
        />
        <StripeProductForm
          suggestions={suggestions}
          submitLabel="Create product"
        />
      </div>
    )
  }

  const categories = await listCategories().catch(() => [])
  return (
    <div className="space-y-6">
      <PageHeading
        title="New product"
        description="Add a product to the Ampere Studio catalog. You can publish it now or keep it in draft."
      />
      <ProductForm categories={categories} submitLabel="Create product" />
    </div>
  )
}

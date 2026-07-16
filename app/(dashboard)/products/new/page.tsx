import { redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { ProductForm } from "@/components/cms/product-form"
import { StripeProductForm } from "@/components/cms/stripe/stripe-product-form"
import { SquareProductForm } from "@/components/cms/square/square-product-form"
import { listCategories } from "@/lib/cms/categories"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { getStripeKeys } from "@/lib/stripe/config"
import { getMetadataSuggestions } from "@/lib/stripe/products"
import { isSquareEnabled } from "@/lib/square/config"
import { listSquareCategories } from "@/lib/square/categories"
import { listOptionPresets } from "@/lib/square/option-templates"
import { listMirrorModifierLists } from "@/lib/square/mirror"
import { getActiveClientId } from "@/lib/cms/client-context"

export const dynamic = "force-dynamic"

export default async function NewProductPage() {
  const catalog = await getActiveCatalogProvider()
  if (!catalog) redirect("/dashboard")

  if (catalog === "stripe") {
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
  }

  if (catalog === "square") {
    const enabled = await isSquareEnabled()
    if (enabled) {
      const [squareCategories, presets, clientId] = await Promise.all([
        listSquareCategories().catch(() => []),
        listOptionPresets().catch(() => []),
        getActiveClientId(),
      ])
      const modifierLists = await listMirrorModifierLists(clientId).catch(
        () => []
      )
      return (
        <div className="space-y-6">
          <PageHeading
            title="New product"
            description="Create a product in your Square catalog. Choose to publish immediately or save as a draft."
          />
          <SquareProductForm
            categories={squareCategories}
            presets={presets}
            existingModifierLists={modifierLists}
            submitLabel="Create product"
          />
        </div>
      )
    }
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

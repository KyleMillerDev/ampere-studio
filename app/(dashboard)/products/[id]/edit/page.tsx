import { notFound, redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { StripeProductForm } from "@/components/cms/stripe/stripe-product-form"
import { SquareProductForm } from "@/components/cms/square/square-product-form"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { getStripeKeys } from "@/lib/stripe/config"
import { getMetadataSuggestions, getStripeProduct } from "@/lib/stripe/products"
import { isSquareEnabled } from "@/lib/square/config"
import { getSquareProduct } from "@/lib/square/products"
import { listSquareCategories } from "@/lib/square/categories"
import { listOptionPresets } from "@/lib/square/option-templates"
import { listMirrorModifierLists } from "@/lib/square/mirror"
import { getActiveClientId } from "@/lib/cms/client-context"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const catalog = await getActiveCatalogProvider()

  if (catalog === "stripe") {
    const stripeKeys = await getStripeKeys()
    if (!stripeKeys) redirect(`/products/${id}`)
    const [product, suggestions] = await Promise.all([
      getStripeProduct(id),
      getMetadataSuggestions().catch(() => ({})),
    ])
    if (!product) notFound()
    return (
      <div className="space-y-6">
        <PageHeading
          title={product.name || "Edit product"}
          description="Changes save directly to this client's Stripe account."
        />
        <StripeProductForm suggestions={suggestions} initial={product} />
      </div>
    )
  }

  if (catalog === "square") {
    const enabled = await isSquareEnabled()
    if (!enabled) redirect(`/products/${id}`)

    const [product, squareCategories, presets, clientId] = await Promise.all([
      getSquareProduct(id),
      listSquareCategories().catch(() => []),
      listOptionPresets().catch(() => []),
      getActiveClientId(),
    ])
    if (!product) notFound()
    const modifierLists = await listMirrorModifierLists(clientId).catch(
      () => []
    )

    return (
      <div className="space-y-6">
        <PageHeading
          title={`Edit: ${product.item_data.name}`}
          description="Changes write directly to Square and refresh the local mirror."
        />
        <SquareProductForm
          initial={product}
          categories={squareCategories}
          presets={presets}
          existingModifierLists={modifierLists}
          submitLabel="Save changes"
        />
      </div>
    )
  }

  redirect(`/products/${id}`)
}

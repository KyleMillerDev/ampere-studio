import { notFound, redirect } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { StripeProductForm } from "@/components/cms/stripe/stripe-product-form"
import { getStripeKeys } from "@/lib/stripe/config"
import { getMetadataSuggestions, getStripeProduct } from "@/lib/stripe/products"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function EditStripeProductPage({ params }: Props) {
  const { id } = await params
  const stripeKeys = await getStripeKeys()
  // CMS mode edits products at /products/[id] directly.
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

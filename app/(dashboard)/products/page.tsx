import Link from "next/link"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { ProductsTable } from "@/components/cms/products-table"
import { StripeProductsTable } from "@/components/cms/stripe/stripe-products-table"
import { Button } from "@/components/ui/button"
import { listCategories } from "@/lib/cms/categories"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { listProducts } from "@/lib/cms/products"
import { getStripeKeys } from "@/lib/stripe/config"
import { listStripeProducts } from "@/lib/stripe/products"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const catalog = await getActiveCatalogProvider()
  if (!catalog) redirect("/dashboard")

  if (catalog === "stripe") {
    const stripeKeys = await getStripeKeys()
    if (stripeKeys) {
      const products = await listStripeProducts().catch(() => [])
      return (
        <div className="space-y-6">
          <PageHeading
            title="Products"
            description="Products synced live from this client's Stripe account."
            actions={
              <Button asChild>
                <Link href="/products/new">
                  <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
                  New product
                </Link>
              </Button>
            }
          />
          <StripeProductsTable products={products} />
        </div>
      )
    }
  }

  const [products, categories] = await Promise.all([
    listProducts().catch(() => []),
    listCategories().catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Products"
        description="Everything in the Ampere Studio catalog for this client."
        actions={
          <Button asChild>
            <Link href="/products/new">
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
              New product
            </Link>
          </Button>
        }
      />
      <ProductsTable products={products} categories={categories} />
    </div>
  )
}

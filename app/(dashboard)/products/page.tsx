import Link from "next/link"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { ProductsTable } from "@/components/cms/products-table"
import { StripeProductsTable } from "@/components/cms/stripe/stripe-products-table"
import { SquareProductsTable } from "@/components/cms/square/square-products-table"
import { Button } from "@/components/ui/button"
import { listCategories } from "@/lib/cms/categories"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { listProducts } from "@/lib/cms/products"
import { getStripeKeys } from "@/lib/stripe/config"
import { listStripeProducts } from "@/lib/stripe/products"
import { isSquareEnabled } from "@/lib/square/config"
import { requireSquareClient } from "@/lib/square/client"
import { getSquareTokens } from "@/lib/square/config"
import { incrementalRefresh } from "@/lib/square/sync"
import { listSquareProducts } from "@/lib/square/products"
import { getActiveClientId } from "@/lib/cms/client-context"

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

  if (catalog === "square") {
    const enabled = await isSquareEnabled()
    if (enabled) {
      // Run incremental refresh before reading from mirror so data is fresh
      try {
        const [sq, tokens, clientId] = await Promise.all([
          requireSquareClient(),
          getSquareTokens(),
          getActiveClientId(),
        ])
        if (sq && tokens) {
          await incrementalRefresh(sq, clientId, tokens.location_id)
        }
      } catch {
        // Non-fatal; stale mirror data is still useful
      }

      const products = await listSquareProducts().catch(() => [])
      return (
        <div className="space-y-6">
          <PageHeading
            title="Products"
            description="Your Square catalog, refreshed from Square on every page load."
            actions={
              <Button asChild>
                <Link href="/products/new">
                  <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
                  New product
                </Link>
              </Button>
            }
          />
          <SquareProductsTable products={products} />
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

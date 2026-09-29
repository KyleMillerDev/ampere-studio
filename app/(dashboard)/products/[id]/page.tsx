import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { ProductForm } from "@/components/cms/product-form"
import { CatalogProductDetail } from "@/components/cms/catalog-product-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listCategories } from "@/lib/cms/categories"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { getProduct } from "@/lib/cms/products"
import { getAmpereProduct, listAmperePrices } from "@/lib/ampere/products"
import { getStripeKeys } from "@/lib/stripe/config"
import { getStripeProduct, listPricesForProduct } from "@/lib/stripe/products"
import { formatUnixDate } from "@/lib/utils"
import { isSquareEnabled } from "@/lib/square/config"
import { getSquareProduct } from "@/lib/square/products"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const catalog = await getActiveCatalogProvider()
  if (!catalog) redirect("/dashboard")

  if (catalog === "ampere") {
    const product = await getAmpereProduct(id)
    if (!product) notFound()
    const prices = await listAmperePrices(product.id).catch(() => [])

    return (
      <div className="space-y-6">
        <PageHeading
          title={product.name}
          description={`Catalog product ${product.id}, created ${formatUnixDate(product.created)}.`}
          actions={
            <Button asChild>
              <Link href={`/products/${product.id}/edit`}>
                <HugeiconsIcon
                  icon={PencilEdit01Icon}
                  className="mr-1 size-4"
                />
                Edit product
              </Link>
            </Button>
          }
        />
        <CatalogProductDetail
          product={product}
          prices={prices}
          catalogSource="ampere"
          pricesDescription="Prices saved on this product."
          pricesEmptyMessage="No prices yet. Add one when you are ready, or leave this product without a price."
        />
      </div>
    )
  }

  if (catalog === "stripe") {
    const stripeKeys = await getStripeKeys()
    if (stripeKeys) {
      const product = await getStripeProduct(id)
      if (!product) notFound()
      const prices = await listPricesForProduct(
        product.id,
        product.defaultPriceId
      ).catch(() => [])

      return (
        <div className="space-y-6">
          <PageHeading
            title={product.name}
            description={`Stripe product ${product.id}, created ${formatUnixDate(product.created)}.`}
            actions={
              <Button asChild>
                <Link href={`/products/${product.id}/edit`}>
                  <HugeiconsIcon
                    icon={PencilEdit01Icon}
                    className="mr-1 size-4"
                  />
                  Edit product
                </Link>
              </Button>
            }
          />

          <CatalogProductDetail product={product} prices={prices} />
        </div>
      )
    }
  }

  if (catalog === "square") {
    const enabled = await isSquareEnabled()
    if (enabled) {
      const product = await getSquareProduct(id)
      if (!product) notFound()
      const variations = product.item_data.variations ?? []

      return (
        <div className="space-y-6">
          <PageHeading
            title={product.item_data.name}
            description={`Square item ${product.raw_id}`}
            actions={
              <Button asChild>
                <Link href={`/products/${product.raw_id}/edit`}>
                  <HugeiconsIcon
                    icon={PencilEdit01Icon}
                    className="mr-1 size-4"
                  />
                  Edit product
                </Link>
              </Button>
            }
          />
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Overview
                  <Badge
                    variant={
                      product.km_status === "Published"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {product.km_status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.item_data.description_html ? (
                  <div
                    className="text-sm"
                    dangerouslySetInnerHTML={{
                      __html: product.item_data.description_html,
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No description.
                  </p>
                )}
                {(product.item_data.image_urls ?? []).length > 0 && (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {(product.item_data.image_urls ?? []).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="aspect-square rounded border object-cover"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variations</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    {variations.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between"
                      >
                        <dt className="text-sm">
                          {v.item_variation_data.name}
                        </dt>
                        <dd className="text-sm font-medium">
                          $
                          {(
                            v.item_variation_data.price_money.amount / 100
                          ).toFixed(2)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
              {product.options && product.options.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Options</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {product.options.map((o) => (
                      <div key={o.id} className="mb-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {o.item_option_data.name}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {o.item_option_data.values.map((v) => (
                            <Badge
                              key={v.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {v.item_option_value_data.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )
    }
  }

  const [product, categories] = await Promise.all([
    getProduct(id),
    listCategories().catch(() => []),
  ])
  if (!product) notFound()

  return (
    <div className="space-y-6">
      <PageHeading
        title={product.name || "Edit product"}
        description="Update product details. Saving takes effect immediately in DynamoDB."
      />
      <ProductForm categories={categories} initial={product} />
    </div>
  )
}

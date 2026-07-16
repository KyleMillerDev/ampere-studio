import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { ProductForm } from "@/components/cms/product-form"
import { PricesCard } from "@/components/cms/stripe/prices-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listCategories } from "@/lib/cms/categories"
import { getActiveCatalogProvider } from "@/lib/cms/clients"
import { getProduct } from "@/lib/cms/products"
import { getStripeKeys } from "@/lib/stripe/config"
import { getStripeProduct, listPricesForProduct } from "@/lib/stripe/products"
import { formatUnixDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const catalog = await getActiveCatalogProvider()
  if (!catalog) redirect("/dashboard")

  if (catalog === "stripe") {
    const stripeKeys = await getStripeKeys()
    if (stripeKeys) {
      const product = await getStripeProduct(id)
      if (!product) notFound()
      const prices = await listPricesForProduct(
        product.id,
        product.defaultPriceId
      ).catch(() => [])

      const metadataEntries = Object.entries(product.metadata)

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

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Overview
                    <Badge variant={product.active ? "default" : "outline"}>
                      {product.active ? "active" : "archived"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.description ? (
                    <p className="text-sm whitespace-pre-wrap">
                      {product.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No description.
                    </p>
                  )}
                  {product.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {product.images.map((url, index) => (
                        <div
                          key={url}
                          className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${product.name} image ${index + 1}`}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                          {index === 0 ? (
                            <Badge
                              variant="secondary"
                              className="absolute bottom-1.5 left-1.5"
                            >
                              Primary
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <PricesCard productId={product.id} prices={prices} />
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Other Info</CardTitle>
                <CardDescription>
                  Extra details attached to this product.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metadataEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other info on this product.
                  </p>
                ) : (
                  <dl className="space-y-3">
                    {metadataEntries.map(([key, value]) => (
                      <div key={key} className="space-y-0.5">
                        <dt className="text-xs font-medium text-muted-foreground">
                          {key}
                        </dt>
                        <dd className="text-sm break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
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

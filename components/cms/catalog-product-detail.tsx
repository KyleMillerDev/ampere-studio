import { PricesCard } from "@/components/cms/stripe/prices-card"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  StripePriceView,
  StripeProductView,
} from "@/lib/validation/stripe-product.schema"

interface CatalogProductDetailProps {
  product: StripeProductView
  prices: StripePriceView[]
  catalogSource?: "stripe" | "ampere"
  pricesDescription?: string
  pricesEmptyMessage?: string
}

/** Shared product detail layout used by Stripe and the Ampere catalog. */
export function CatalogProductDetail({
  product,
  prices,
  catalogSource = "stripe",
  pricesDescription,
  pricesEmptyMessage,
}: CatalogProductDetailProps) {
  const metadataEntries = Object.entries(product.metadata)

  return (
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
              <p className="text-sm text-muted-foreground">No description.</p>
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

        <PricesCard
          productId={product.id}
          prices={prices}
          catalogSource={catalogSource}
          description={pricesDescription}
          emptyMessage={pricesEmptyMessage}
        />
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
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  MetadataFields,
  buildMetadataRows,
  type MetadataRow,
} from "@/components/cms/stripe/metadata-fields"
import { ProductImagesField } from "@/components/cms/stripe/product-images-field"
import {
  PriceFields,
  emptyPriceDraft,
  priceDraftMatchesView,
  priceDraftToInput,
  priceViewToDraft,
  type PriceDraft,
} from "@/components/cms/stripe/price-fields"
import type {
  MetadataSuggestions,
  StripeProductView,
} from "@/lib/validation/stripe-product.schema"

const detailsSchema = z.object({
  name: z.string().min(1, "Name is required").max(250),
  description: z.string().max(5000),
  active: z.boolean(),
})

type DetailsInput = z.infer<typeof detailsSchema>

interface StripeProductFormProps {
  suggestions: MetadataSuggestions
  initial?: StripeProductView
  submitLabel?: string
}

export function StripeProductForm({
  suggestions,
  initial,
  submitLabel,
}: StripeProductFormProps) {
  const router = useRouter()
  const [images, setImages] = useState<string[]>(initial?.images ?? [])
  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>(() =>
    buildMetadataRows(suggestions, initial?.metadata)
  )
  const [withPrice, setWithPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState<PriceDraft>(emptyPriceDraft)
  const [editPriceDraft, setEditPriceDraft] = useState<PriceDraft>(() =>
    priceViewToDraft(initial?.defaultPrice ?? null)
  )
  const [isArchiving, setIsArchiving] = useState(false)

  const form = useForm<DetailsInput>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      active: initial?.active ?? true,
    },
  })

  function collectMetadata(): Record<string, string> | null {
    const metadata: Record<string, string> = {}
    for (const row of metadataRows) {
      const key = row.key.trim()
      if (!key) {
        if (row.value.trim()) {
          toast.error("Other info values need a field name")
          return null
        }
        continue
      }
      if (!row.value.trim()) continue
      if (key in metadata) {
        toast.error(`Duplicate field name "${key}"`)
        return null
      }
      metadata[key] = row.value.trim()
    }
    return metadata
  }

  async function applyPriceChange(productId: string): Promise<boolean> {
    const oldDefault = initial?.defaultPrice ?? null
    const changed = oldDefault
      ? !priceDraftMatchesView(editPriceDraft, oldDefault)
      : editPriceDraft.amount.trim().length > 0

    if (!changed) return true

    const result = priceDraftToInput(editPriceDraft)
    if ("error" in result) {
      toast.error(result.error)
      return false
    }

    const createRes = await fetch(`/api/stripe/products/${productId}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.input),
    })
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}))
      toast.error(err.error ?? "Could not update price")
      return false
    }
    const { price: newPrice } = (await createRes.json()) as {
      price: { id: string }
    }

    const defaultRes = await fetch(`/api/stripe/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPriceId: newPrice.id }),
    })
    if (!defaultRes.ok) {
      const err = await defaultRes.json().catch(() => ({}))
      toast.error(err.error ?? "Could not set default price")
      return false
    }

    if (oldDefault?.active) {
      await fetch(`/api/stripe/prices/${oldDefault.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      })
    }

    return true
  }

  async function onSubmit(values: DetailsInput) {
    const metadata = collectMetadata()
    if (!metadata) return

    let defaultPrice
    if (!initial && withPrice) {
      const result = priceDraftToInput(priceDraft)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      defaultPrice = result.input
    }

    const url = initial
      ? `/api/stripe/products/${initial.id}`
      : "/api/stripe/products"
    const method = initial ? "PATCH" : "POST"
    const payload = initial
      ? { ...values, images, metadata }
      : { ...values, images, metadata, defaultPrice }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Could not save product")
      return
    }
    const data = (await res.json()) as { product: StripeProductView }

    if (initial) {
      const priceOk = await applyPriceChange(data.product.id)
      if (!priceOk) return
    }

    toast.success(initial ? "Product updated" : "Product created")
    router.push(`/products/${data.product.id}`)
    router.refresh()
  }

  async function onArchive() {
    if (!initial) return
    const ok = window.confirm(
      `Archive "${initial.name}"? It stays in Stripe but is hidden from new purchases.`
    )
    if (!ok) return
    setIsArchiving(true)
    const res = await fetch(`/api/stripe/products/${initial.id}`, {
      method: "DELETE",
    })
    setIsArchiving(false)
    if (!res.ok) {
      toast.error("Could not archive product")
      return
    }
    toast.success("Product archived")
    router.push("/products")
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product details</CardTitle>
                <CardDescription>
                  The name and description shown on Stripe checkout pages and
                  invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Bloomfield Canvas Tote"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="Tell the story behind this product, the materials, and what it is best used for."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>
                  Upload, remove, and drag to rearrange. The first image is the
                  primary one customers see.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductImagesField images={images} onChange={setImages} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other Info</CardTitle>
                <CardDescription>
                  Optional fields based on what your other products use. Leave
                  any blank to skip them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MetadataFields
                  rows={metadataRows}
                  onChange={setMetadataRows}
                  suggestions={suggestions}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>
                  Inactive products are hidden from new purchases.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Active</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {initial ? (
              <Card>
                <CardHeader>
                  <CardTitle>Price</CardTitle>
                  <CardDescription>
                    Update the default selling price. Stripe cannot edit an
                    existing price, so changing the amount creates a new one and
                    archives the previous default.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PriceFields
                    draft={editPriceDraft}
                    onChange={setEditPriceDraft}
                    idPrefix="edit-price"
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Initial price</CardTitle>
                  <CardDescription>
                    Optionally create a default price with this product. You can
                    add more prices afterwards.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Add a default price
                    </span>
                    <Switch
                      checked={withPrice}
                      onCheckedChange={setWithPrice}
                    />
                  </div>
                  {withPrice ? (
                    <PriceFields
                      draft={priceDraft}
                      onChange={setPriceDraft}
                      idPrefix="initial-price"
                    />
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {initial && initial.active ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onArchive}
                disabled={isArchiving}
              >
                {isArchiving ? "Archiving..." : "Archive product"}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link href={initial ? `/products/${initial.id}` : "/products"}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Saving..."
                : (submitLabel ??
                  (initial ? "Save changes" : "Create product"))}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

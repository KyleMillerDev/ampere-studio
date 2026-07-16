"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { RentalImagesField } from "@/components/cms/rental-images-field"
import {
  PROPERTY_TYPES,
  RENTAL_STATUS_LABELS,
  rentalCreateSchema,
  type RentalFormInput,
  type RentalCreateInput,
  type RentalRecord,
} from "@/lib/validation/rental.schema"

interface RentalFormProps {
  initial?: RentalRecord
}

export function RentalForm({ initial }: RentalFormProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const isEdit = Boolean(initial)

  const form = useForm<RentalFormInput, unknown, RentalCreateInput>({
    resolver: zodResolver(rentalCreateSchema),
    defaultValues: {
      slug: initial?.slug ?? "",
      status: initial?.status ?? "active",
      mlsId: initial?.mlsId ?? null,
      price: initial?.price ?? 0,
      address: initial?.address ?? { street: "", city: "", state: "", zip: "" },
      county: initial?.county ?? "",
      lat: initial?.lat ?? 0,
      lng: initial?.lng ?? 0,
      beds: initial?.beds ?? 0,
      baths: initial?.baths ?? 0,
      halfBaths: initial?.halfBaths ?? 0,
      sqft: initial?.sqft ?? 0,
      lotSizeAcres: initial?.lotSizeAcres ?? 0,
      yearBuilt: initial?.yearBuilt ?? 0,
      propertyType: initial?.propertyType ?? "single-family",
      garageSpaces: initial?.garageSpaces ?? 0,
      stories: initial?.stories ?? 1,
      hoaFee: initial?.hoaFee ?? 0,
      propertyTax: initial?.propertyTax ?? 0,
      daysOnMarket: initial?.daysOnMarket ?? 0,
      listedDate: initial?.listedDate ?? new Date().toISOString().slice(0, 10),
      description: initial?.description ?? "",
      features: initial?.features ?? [],
      images: initial?.images ?? [],
      agent: initial?.agent ?? { name: "", phone: "", email: "" },
    },
  })

  async function onSubmit(values: RentalCreateInput) {
    const url = isEdit ? `/api/rentals/${initial!.id}` : "/api/rentals"
    const method = isEdit ? "PATCH" : "POST"

    const payload = isEdit ? { ...values, slug: undefined } : values

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error((err as { error?: string }).error ?? "Could not save rental")
      return
    }

    toast.success(isEdit ? "Rental updated" : "Rental created")
    router.push("/rentals")
    router.refresh()
  }

  async function onDelete() {
    if (!initial) return
    const label = `${initial.address.street}, ${initial.address.city}`
    const ok = window.confirm(`Delete "${label}"? This cannot be undone.`)
    if (!ok) return
    setIsDeleting(true)
    const res = await fetch(`/api/rentals/${initial.id}`, {
      method: "DELETE",
    })
    setIsDeleting(false)
    if (!res.ok) {
      toast.error("Could not delete rental")
      return
    }
    toast.success("Rental deleted")
    router.push("/rentals")
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Row 1: Details + Status sidebar ─────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Details */}
          <div className="space-y-6">
            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>
                  The property address displayed on listing pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="address.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Bloomfield" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="IA" maxLength={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address.zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="52537" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <FormControl>
                          <Input placeholder="Davis County" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isEdit && (
                    <FormItem>
                      <FormLabel>Slug (locked)</FormLabel>
                      <FormControl>
                        <Input value={initial!.slug} disabled readOnly />
                      </FormControl>
                      <FormDescription>
                        The slug is part of the listing URL and cannot be
                        changed after creation.
                      </FormDescription>
                    </FormItem>
                  )}
                  {!isEdit && (
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="auto-generated from address"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Leave blank to auto-generate from the address.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="lat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="41.123456"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lng"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="-92.123456"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Property facts */}
            <Card>
              <CardHeader>
                <CardTitle>Property facts</CardTitle>
                <CardDescription>
                  Details shown in listing summaries and search filters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROPERTY_TYPES.map((pt) => (
                              <SelectItem key={pt} value={pt}>
                                {pt
                                  .replace(/-/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="yearBuilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year built</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="2005"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="beds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beds</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full baths</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="halfBaths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Half baths</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sq ft</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="garageSpaces"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garage spaces</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stories</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lotSizeAcres"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lot size (acres)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="hoaFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HOA fee ($/mo)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propertyTax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property tax ($/yr)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="daysOnMarket"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days on market</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Description & features */}
            <Card>
              <CardHeader>
                <CardTitle>Description &amp; features</CardTitle>
                <CardDescription>
                  The listing description and amenity tags shown on the tenant
                  site.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={8}
                          placeholder="Describe the property, its highlights, and what makes it a great home."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="features"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amenity tags</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="In-Unit Laundry, Garage, Pet Friendly (comma-separated)"
                          value={field.value?.join(", ") ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value
                            field.onChange(
                              raw
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean)
                            )
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Comma-separated list of amenity tags. Order is
                        preserved.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>
                  Ordered image list. The first image is the primary thumbnail.
                  Paste URLs or upload files to your media library.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RentalImagesField
                          value={field.value ?? []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Monthly rent shown as $price/mo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly rent ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          placeholder="1200"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Integer dollar amount, no currency symbol.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mlsId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MLS ID (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Usually blank for rentals"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value.trim() || null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="listedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listed date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Listing status</CardTitle>
                <CardDescription>
                  For Rent is publicly visible. Rented hides the listing from
                  the tenant site.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(RENTAL_STATUS_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Contact / agent */}
            <Card>
              <CardHeader>
                <CardTitle>Contact info</CardTitle>
                <CardDescription>
                  Agent shown on the listing detail page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="agent.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent name</FormLabel>
                      <FormControl>
                        <Input placeholder="Kyle Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agent.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="(641) 555-0100"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agent.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="kyle@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete rental"}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link href="/rentals">Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Create rental"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

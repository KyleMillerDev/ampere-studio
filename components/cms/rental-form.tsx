"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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

// ── Reusable adornment wrappers ──────────────────────────────────────────────

function InputPrefix({
  prefix,
  children,
}: {
  prefix: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
        {prefix}
      </span>
      <div className="[&_input]:pl-7">{children}</div>
    </div>
  )
}

function InputSuffix({
  suffix,
  children,
}: {
  suffix: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div className="[&_input]:pr-16">{children}</div>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}

// ── Amenity tag chip input ───────────────────────────────────────────────────

function AmenityTagsInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const trimmed = raw.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input)
  }

  // Handle pasted comma-separated lists
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text")
    if (text.includes(",")) {
      e.preventDefault()
      const tags = text
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      const next = [...value]
      for (const tag of tags) {
        if (!next.includes(tag)) next.push(tag)
      }
      onChange(next)
    }
  }

  return (
    <div
      className="flex min-h-10 w-full cursor-text flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 focus:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder={
          value.length === 0
            ? "Type a tag and press Enter or comma…"
            : "Add more…"
        }
        className="min-w-35 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ── Dropdown option builders ─────────────────────────────────────────────────

const BED_OPTIONS = [
  { value: 0, label: "Studio / 0" },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}`,
  })),
]

const BATH_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: i,
  label: `${i}`,
}))

const HALF_BATH_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: i,
  label: `${i}`,
}))

const GARAGE_OPTIONS = [
  { value: 0, label: "None" },
  ...Array.from({ length: 6 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}`,
  })),
]

const STORIES_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4+" },
]

// ── Main form ────────────────────────────────────────────────────────────────

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
    const res = await fetch(`/api/rentals/${initial.id}`, { method: "DELETE" })
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
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* ── Left column ───────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Location ------------------------------------------------ */}
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

                {/* City / State / ZIP */}
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
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
                          <Input
                            placeholder="IA"
                            maxLength={2}
                            className="uppercase"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value.toUpperCase())
                            }
                          />
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
                          <Input
                            placeholder="52537"
                            inputMode="numeric"
                            maxLength={10}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* County / Slug */}
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
                  {isEdit ? (
                    <FormItem>
                      <FormLabel>URL slug (locked)</FormLabel>
                      <FormControl>
                        <Input value={initial!.slug} disabled readOnly />
                      </FormControl>
                      <FormDescription>
                        Locked after creation to preserve listing URLs.
                      </FormDescription>
                    </FormItem>
                  ) : (
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL slug</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Leave blank to auto-generate"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Auto-generated from the address if left blank.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Lat / Lng */}
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

            {/* Property details ---------------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Property details</CardTitle>
                <CardDescription>
                  Shown in listing summaries and search filters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Type & Year */}
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
                            min={1800}
                            max={new Date().getFullYear() + 2}
                            step={1}
                            placeholder={String(new Date().getFullYear())}
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

                {/* Beds / Full Baths / Half Baths */}
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">
                    Bedrooms &amp; bathrooms
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="beds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bedrooms</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BED_OPTIONS.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={String(o.value)}
                                >
                                  {o.label}
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
                      name="baths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full baths</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {BATH_OPTIONS.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={String(o.value)}
                                >
                                  {o.label}
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
                      name="halfBaths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Half baths</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {HALF_BATH_OPTIONS.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={String(o.value)}
                                >
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Size */}
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">
                    Size
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sqft"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Square footage</FormLabel>
                          <FormControl>
                            <InputSuffix suffix="sq ft">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                placeholder="1,200"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                              />
                            </InputSuffix>
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
                          <FormLabel>Lot size</FormLabel>
                          <FormControl>
                            <InputSuffix suffix="acres">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="0.25"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </InputSuffix>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Garage / Stories */}
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">
                    Structure
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="garageSpaces"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Garage spaces</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {GARAGE_OPTIONS.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={String(o.value)}
                                >
                                  {o.label}
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
                      name="stories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stories</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STORIES_OPTIONS.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={String(o.value)}
                                >
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Financial / market */}
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">
                    Financials &amp; market info
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="hoaFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HOA fee</FormLabel>
                          <FormControl>
                            <InputPrefix prefix="$">
                              <InputSuffix suffix="/mo">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  inputMode="numeric"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </InputSuffix>
                            </InputPrefix>
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
                          <FormLabel>Property tax</FormLabel>
                          <FormControl>
                            <InputPrefix prefix="$">
                              <InputSuffix suffix="/yr">
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  inputMode="numeric"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </InputSuffix>
                            </InputPrefix>
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
                            <InputSuffix suffix="days">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                placeholder="0"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                              />
                            </InputSuffix>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description & features ---------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Description &amp; amenities</CardTitle>
                <CardDescription>
                  The listing description and feature tags shown on the tenant
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
                          rows={6}
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
                        <AmenityTagsInput
                          value={field.value ?? []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        Type a tag and press Enter or comma to add. Press
                        Backspace to remove the last tag.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Images -------------------------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>
                  The first photo is used as the primary thumbnail. Drag to
                  reorder. Paste URLs or upload directly from your device.
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

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Pricing ------------------------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Monthly rent and listing date.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly rent</FormLabel>
                      <FormControl>
                        <InputPrefix prefix="$">
                          <InputSuffix suffix="/mo">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              placeholder="1,200"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                            />
                          </InputSuffix>
                        </InputPrefix>
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
                <FormField
                  control={form.control}
                  name="mlsId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        MLS ID{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </FormLabel>
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
              </CardContent>
            </Card>

            {/* Status -------------------------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Listing status</CardTitle>
                <CardDescription>
                  "For Rent" is publicly visible. "Rented" hides the listing
                  from the tenant site.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
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

            {/* Contact / agent ----------------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Contact info</CardTitle>
                <CardDescription>
                  Shown on the listing detail page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="agent.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
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

        {/* Actions ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete rental"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link href="/rentals">Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Saving…"
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

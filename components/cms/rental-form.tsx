"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
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
import { RentalLocationFields } from "@/components/cms/rental-location-fields"
import { RentalRequiredLabel } from "@/components/cms/rental-required-label"
import { PageHeading } from "@/components/cms/page-heading"
import type { RealtyDefaultContact } from "@/lib/cms/realty-default-contact"
import {
  getRentalStatusCardClassName,
  getRentalVisibilityMessage,
  getRentalVisibilityTextClassName,
} from "@/lib/cms/rental-status-visibility"
import {
  getAvailableAmenitySuggestions,
  hasAmenityTag,
} from "@/lib/constants/rental-amenity-suggestions"
import {
  PROPERTY_TYPES,
  RENTAL_COUNTIES,
  RENTAL_STATUS_LABELS,
  formatPropertyTypeLabel,
  normalizePropertyType,
  rentalCreateSchema,
  type RentalFormInput,
  type RentalCreateInput,
  type RentalRecord,
} from "@/lib/validation/rental.schema"
import { cn } from "@/lib/utils"

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

  const availableSuggestions = getAvailableAmenitySuggestions(value)

  function addTag(raw: string) {
    const trimmed = raw.trim()
    if (trimmed && !hasAmenityTag(value, trimmed)) {
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
        if (!hasAmenityTag(next, tag)) next.push(tag)
      }
      onChange(next)
    }
  }

  return (
    <div className="space-y-2">
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
      {availableSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {availableSuggestions.map((suggestion) => (
            <Badge key={suggestion} variant="outline" asChild>
              <button
                type="button"
                onClick={() => addTag(suggestion)}
                className="cursor-pointer hover:bg-muted"
              >
                {suggestion}
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
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
  defaultContact?: RealtyDefaultContact
  heading: {
    title: string
    description?: string
  }
}

function normalizeCounty(
  county: string | undefined
): RentalFormInput["county"] | undefined {
  if (!county) return undefined
  return (RENTAL_COUNTIES as readonly string[]).includes(county)
    ? (county as RentalFormInput["county"])
    : undefined
}

export function RentalForm({
  initial,
  defaultContact,
  heading,
}: RentalFormProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const isEdit = Boolean(initial)

  const form = useForm<RentalFormInput, unknown, RentalCreateInput>({
    resolver: zodResolver(rentalCreateSchema),
    defaultValues: {
      status: initial?.status ?? "active",
      price: initial?.price ?? 0,
      address: initial?.address ?? {
        street: "",
        city: "",
        state: "IA",
        zip: "",
      },
      county: normalizeCounty(initial?.county),
      lat: initial?.lat ?? 0,
      lng: initial?.lng ?? 0,
      beds: initial?.beds ?? 0,
      baths: initial?.baths ?? 0,
      halfBaths: initial?.halfBaths ?? 0,
      sqft: initial?.sqft ?? 0,
      propertyType: normalizePropertyType(initial?.propertyType),
      garageSpaces: initial?.garageSpaces ?? 0,
      stories: initial?.stories ?? 1,
      listedDate: initial?.listedDate ?? new Date().toISOString().slice(0, 10),
      description: initial?.description ?? "",
      features: initial?.features ?? [],
      images: initial?.images ?? [],
      agent: {
        name: initial?.agent?.name || defaultContact?.name || "",
        phone: initial?.agent?.phone || defaultContact?.phone || "",
        email: initial?.agent?.email || defaultContact?.email || "",
      },
    } as RentalFormInput,
  })

  const status = useWatch({ control: form.control, name: "status" }) ?? "active"
  const visibility = getRentalVisibilityMessage(status, {
    isEdit,
    savedStatus: initial?.status,
  })

  async function onSubmit(values: RentalCreateInput) {
    let payload: RentalCreateInput = { ...values }
    delete (payload as { slug?: string }).slug

    if (payload.lat === 0 || payload.lng === 0) {
      const geoRes = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: payload.address }),
      })
      if (geoRes.ok) {
        const coords = (await geoRes.json()) as { lat: number; lng: number }
        payload = { ...payload, lat: coords.lat, lng: coords.lng }
      } else if (payload.lat === 0 && payload.lng === 0) {
        toast.error(
          "Could not locate this address. Check the street, city, state, and ZIP."
        )
        return
      }
    }

    const url = isEdit ? `/api/rentals/${initial!.id}` : "/api/rentals"
    const method = isEdit ? "PATCH" : "POST"

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

  const submitLabel = form.formState.isSubmitting
    ? "Saving…"
    : isEdit
      ? "Save changes"
      : "Create rental"

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
        <PageHeading
          title={heading.title}
          description={heading.description}
          actions={
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="hidden lg:inline-flex"
            >
              {submitLabel}
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div className="contents lg:col-start-1 lg:flex lg:flex-col lg:gap-6 lg:self-start">
            {/* Location ------------------------------------------------ */}
            <Card className="order-1 lg:w-full lg:self-start">
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>
                  The property address displayed on listing pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RentalLocationFields form={form} mapsApiKey={mapsApiKey} />
              </CardContent>
            </Card>

            {/* Pricing (mobile: after status; desktop: under location) */}
            <Card className="order-3 lg:w-full lg:self-start">
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
                      <RentalRequiredLabel name="price">
                        Monthly rent
                      </RentalRequiredLabel>
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
                      <RentalRequiredLabel name="listedDate">
                        Listed date
                      </RentalRequiredLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="contents lg:sticky lg:top-6 lg:col-start-2 lg:flex lg:flex-col lg:gap-6 lg:self-start">
            {/* Status (mobile: after location; desktop: sidebar) */}
            <Card
              className={cn(
                "order-2 transition-[box-shadow,border-color,ring-color] lg:order-none",
                getRentalStatusCardClassName(status)
              )}
            >
              <CardHeader>
                <CardTitle>Listing status</CardTitle>
                <CardDescription>
                  Choose whether this listing appears on your public website.
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
                      <p
                        className={cn(
                          "text-xs font-medium",
                          getRentalVisibilityTextClassName(visibility.tone)
                        )}
                      >
                        {visibility.text}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Contact (mobile: after photos; desktop: sidebar) */}
            <Card className="order-7 lg:order-none">
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

          {/* Property details ---------------------------------------- */}
          <Card className="order-4 lg:col-start-1">
            <CardHeader>
              <CardTitle>Property details</CardTitle>
              <CardDescription>
                Shown in listing summaries and search filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem>
                    <RentalRequiredLabel name="propertyType">
                      Property type
                    </RentalRequiredLabel>
                    <Select
                      value={normalizePropertyType(
                        typeof field.value === "string" ? field.value : undefined
                      )}
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
                            {formatPropertyTypeLabel(pt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                              <SelectItem key={o.value} value={String(o.value)}>
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
                              <SelectItem key={o.value} value={String(o.value)}>
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
                              <SelectItem key={o.value} value={String(o.value)}>
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
                <p className="mb-3 text-sm font-medium text-foreground">Size</p>
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
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </InputSuffix>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                              <SelectItem key={o.value} value={String(o.value)}>
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
                              <SelectItem key={o.value} value={String(o.value)}>
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
            </CardContent>
          </Card>

          {/* Description & features ---------------------------------- */}
          <Card className="order-5 lg:col-start-1">
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
                      Type a tag and press Enter or comma to add, or click a
                      suggestion below. Press Backspace to remove the last tag.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Images -------------------------------------------------- */}
          <Card className="order-6 lg:col-start-1">
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
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="lg:hidden"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  PlusIcon,
  Trash2Icon,
  WandSparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DollarInput } from "@/components/ui/dollar-input"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type {
  SquareMirrorProduct,
  SquareMirrorCategory,
  SquareOptionPreset,
  CatalogModifierList,
} from "@/lib/square/types"
import {
  VARIATION_LIMIT,
  OPTION_LIMIT,
  OPTION_VALUE_LIMIT,
  MODIFIER_LIST_LIMIT,
} from "@/lib/validation/square.schema"
import { DateTimePicker } from "@/components/cms/square/date-time-picker"
import { SquareProductImageGallery } from "@/components/cms/square/square-product-image-gallery"

const FULFILLMENT_OPTIONS = [
  { value: "PICKUP", label: "Pickup" },
  { value: "SHIPPING", label: "Shipping" },
] as const

function parseFulfillments(value: string): string[] {
  return value
    .split(/\s+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
}

function buildFulfillments(selected: string[]): string {
  return selected.join(" ")
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const optionValueSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Option value name required").max(255),
  km_markup: z.coerce.number().min(-10000).max(10000),
})

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Option name required").max(255),
  values: z
    .array(optionValueSchema)
    .min(1, "At least one value required")
    .max(OPTION_VALUE_LIMIT),
})

const variationSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  price_override: z.coerce.number().int().nonnegative().optional(),
  km_inventory: z.coerce.number().int().nonnegative().optional(),
})

const modifierSchema = z.object({
  name: z.string().min(1, "Modifier name required"),
  price_cents: z.coerce.number().int().nonnegative().optional(),
})

const modifierListSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Modifier list name required"),
  selection_type: z.enum(["SINGLE", "MULTIPLE"]),
  modifiers: z
    .array(modifierSchema)
    .min(1, "At least one modifier required")
    .max(100),
})

const formSchema = z.object({
  name: z.string().min(1, "Product name required").max(512),
  price: z.coerce
    .number()
    .int("Price must be in cents")
    .nonnegative()
    .max(99999999),
  description_html: z.string().max(65535).optional(),
  status: z.enum(["Published", "Draft"]),
  available_online: z.boolean(),
  allow_product_note: z.boolean(),
  allow_product_personalization: z.boolean(),
  allowed_fulfillments: z.string(),
  available_from_date: z.string().optional(),
  available_until_date: z.string().optional(),
  category_ids: z.array(z.string()),
  options: z.array(optionSchema).max(OPTION_LIMIT),
  modifier_lists: z.array(modifierListSchema).max(MODIFIER_LIST_LIMIT),
  image_urls: z.array(z.string()),
})

type FormValues = z.infer<typeof formSchema>

// ─── Variation computation ────────────────────────────────────────────────────

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restCombined = cartesian(rest)
  return first.flatMap((a) => restCombined.map((b) => [a, ...b]))
}

type ComputedVariation = { name: string; price: number; optionKey: string }

function computeVariations(
  options: FormValues["options"],
  basePriceCents: number
): ComputedVariation[] {
  if (!options || options.length === 0) {
    return [{ name: "Regular", price: basePriceCents, optionKey: "default" }]
  }
  const valueCombos = cartesian(options.map((o) => o.values))
  if (valueCombos.length > VARIATION_LIMIT) return []
  return valueCombos.map((combo) => {
    const names = combo.map((v) => v.name).join(", ")
    const markupCents = combo.reduce(
      (s, v) => s + Math.round((v.km_markup ?? 0) * 100),
      0
    )
    const price = Math.max(0, basePriceCents + markupCents)
    return { name: names, price, optionKey: names }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initial?: SquareMirrorProduct
  categories: SquareMirrorCategory[]
  presets: SquareOptionPreset[]
  existingModifierLists?: CatalogModifierList[]
  submitLabel?: string
}

export function SquareProductForm({
  initial,
  categories,
  presets,
  existingModifierLists = [],
  submitLabel = "Save product",
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDescriptions, setAiDescriptions] = useState<string[]>([])
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiImageLoading, setAiImageLoading] = useState(false)
  const [variationOverrides, setVariationOverrides] = useState<
    Record<string, number>
  >({})
  const [variationInventory, setVariationInventory] = useState<
    Record<string, number>
  >({})
  const [categorySearch, setCategorySearch] = useState("")
  const [presetSelectKey, setPresetSelectKey] = useState(0)

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase()
    if (!query) return categories
    return categories.filter((cat) =>
      cat.category_data.name.toLowerCase().includes(query)
    )
  }, [categories, categorySearch])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: initial?.item_data.name ?? "",
      price:
        initial?.item_data.variations?.[0]?.item_variation_data.price_money
          .amount ?? 0,
      description_html: initial?.item_data.description_html ?? "",
      status: (initial?.km_status as "Published" | "Draft") ?? "Draft",
      available_online: initial?.item_data.available_online ?? true,
      allow_product_note:
        initial?.custom_attribute_values?.allow_product_note?.boolean_value ??
        false,
      allow_product_personalization:
        initial?.custom_attribute_values?.allow_product_personalization
          ?.boolean_value ?? false,
      allowed_fulfillments:
        initial?.custom_attribute_values?.allowed_fulfillments?.string_value ??
        "PICKUP SHIPPING",
      available_from_date: initial?.item_data.km_available_from_date ?? "",
      available_until_date: initial?.item_data.km_available_until_date ?? "",
      category_ids: initial?.item_data.categories?.map((c) => c.id) ?? [],
      options:
        initial?.options?.map((o) => ({
          id: o.id,
          name: o.item_option_data.name,
          values: o.item_option_data.values.map((v) => ({
            id: v.id,
            name: v.item_option_value_data.name,
            km_markup: v.item_option_value_data.km_markup ?? 0,
          })),
        })) ?? [],
      modifier_lists:
        initial?.modifier_lists?.map((ml) => ({
          id: ml.id,
          name: ml.modifier_list_data.name,
          selection_type: (ml.modifier_list_data.selection_type ?? "SINGLE") as
            | "SINGLE"
            | "MULTIPLE",
          modifiers: ml.modifier_list_data.modifiers.map((m) => ({
            name: m.modifier_data.name,
            price_cents: m.modifier_data.price_money?.amount,
          })),
        })) ?? [],
      image_urls: initial?.item_data.image_urls ?? [],
    },
  })

  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption,
  } = useFieldArray({ control: form.control, name: "options" })

  const {
    fields: modifierListFields,
    append: appendModifierList,
    remove: removeModifierList,
  } = useFieldArray({ control: form.control, name: "modifier_lists" })

  const watchedOptions = form.watch("options")
  const watchedPrice = form.watch("price")

  const variations = useMemo(() => {
    return computeVariations(watchedOptions, watchedPrice ?? 0)
  }, [watchedOptions, watchedPrice])

  const variationCountExceeded = useMemo(() => {
    const combos = watchedOptions.reduce(
      (acc, o) => acc * Math.max(1, o.values.length),
      1
    )
    return combos > VARIATION_LIMIT
  }, [watchedOptions])

  // ─── AI description ─────────────────────────────────────────────────────────

  async function handleAiDescription() {
    setAiLoading(true)
    try {
      const res = await fetch("/api/square/ai/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.getValues("name"),
          description: form.getValues("description_html"),
          category_names: categories
            .filter((c) => form.getValues("category_ids").includes(c.raw_id))
            .map((c) => c.category_data.name),
          price: form.getValues("price"),
          variation_names: variations.map((v) => v.name),
        }),
      })
      const data = (await res.json()) as {
        descriptions?: string[]
        error?: string
      }
      if (!res.ok)
        throw new Error(data.error ?? "Failed to generate descriptions")
      setAiDescriptions(data.descriptions ?? [])
      setAiDialogOpen(true)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not generate descriptions"
      )
    } finally {
      setAiLoading(false)
    }
  }

  // ─── AI image generation ─────────────────────────────────────────────────────

  async function handleAiImage(style: string) {
    setAiImageLoading(true)
    try {
      const res = await fetch("/api/square/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: form.getValues("name"),
          description: form.getValues("description_html"),
          style,
        }),
      })
      const data = (await res.json()) as { imageUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to generate image")
      if (data.imageUrl) {
        form.setValue("image_urls", [
          data.imageUrl,
          ...form.getValues("image_urls"),
        ])
        toast.success("AI image generated and added to gallery")
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not generate image"
      )
    } finally {
      setAiImageLoading(false)
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    if (variationCountExceeded) {
      toast.error(
        `Too many option combinations. Reduce option values to stay under ${VARIATION_LIMIT} variations.`
      )
      return
    }

    setSaving(true)
    try {
      // Build payload
      const payload = {
        name: values.name,
        price: values.price,
        description_html: values.description_html,
        status: values.status,
        available_online: values.available_online,
        allow_product_note: values.allow_product_note,
        allow_product_personalization: values.allow_product_personalization,
        allowed_fulfillments: values.allowed_fulfillments,
        available_from_date: values.available_from_date || undefined,
        available_until_date: values.available_until_date || undefined,
        category_ids: values.category_ids,
        image_urls: values.image_urls,
        options: values.options.map((o) => ({
          id: o.id,
          item_option_data: {
            name: o.name,
            values: o.values.map((v, i) => ({
              id: v.id,
              item_option_value_data: {
                name: v.name,
                ordinal: i,
                km_markup: v.km_markup,
                item_option_id: o.id,
              },
            })),
          },
        })),
        modifiers: values.modifier_lists.map((ml) => ({
          id: ml.id,
          name: ml.name,
          selection_type: ml.selection_type,
          modifiers: ml.modifiers.map((m, i) => ({
            name: m.name,
            price_cents: m.price_cents,
            ordinal: i,
          })),
        })),
        // Inventory from state
        km_markups: Object.fromEntries(
          values.options.flatMap((o) =>
            o.values
              .filter((v) => v.km_markup && v.km_markup !== 0)
              .map((v) => [v.id ?? v.name, v.km_markup])
          )
        ),
      }

      const isEdit = Boolean(initial?.raw_id)
      const url = isEdit
        ? `/api/square/products/${initial!.raw_id}`
        : "/api/square/products"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")

      toast.success(isEdit ? "Product updated" : "Product created")
      router.push("/products")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  // ─── Preset loader ───────────────────────────────────────────────────────────

  function loadPreset(preset: SquareOptionPreset) {
    if (optionFields.length >= OPTION_LIMIT) {
      toast.error(`Products can have at most ${OPTION_LIMIT} option dimensions`)
      return
    }
    const o = preset.option
    const displayName =
      preset.name || o.item_option_data.display_name || o.item_option_data.name
    appendOption({
      id: o.id ?? preset.raw_id,
      name: displayName,
      values: o.item_option_data.values.map((v) => ({
        id: v.id,
        name: v.item_option_value_data.name,
        km_markup: v.item_option_value_data.km_markup ?? 0,
      })),
    })
    toast.success(`Loaded preset: ${preset.name}`)
  }

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ─── Row 1: Details + Sidebar ──────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Product details */}
            <Card>
              <CardHeader>
                <CardTitle>Product details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Classic T-Shirt" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <DollarInput
                            className="pl-7"
                            value={field.value ?? 0}
                            onChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description_html"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Description</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleAiDescription}
                          disabled={aiLoading || !form.getValues("name")}
                          className="gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <WandSparklesIcon className="size-3.5" />
                          {aiLoading ? "Generating..." : "AI suggest"}
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Describe your product..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Availability scheduling */}
            <Card>
              <CardHeader>
                <CardTitle>Availability window</CardTitle>
                <CardDescription>
                  Optionally schedule when this product becomes available and
                  when it expires.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="available_from_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available from</FormLabel>
                      <FormControl>
                        <DateTimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select start date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="available_until_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available until</FormLabel>
                      <FormControl>
                        <DateTimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select end date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>Options</CardTitle>
                    <CardDescription>
                      Define dimensions like size or color. Each combination
                      becomes a variation.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {presets.length > 0 && (
                      <Select
                        key={presetSelectKey}
                        onValueChange={(presetId) => {
                          const preset = presets.find(
                            (p) => p.raw_id === presetId
                          )
                          if (preset) loadPreset(preset)
                          setPresetSelectKey((key) => key + 1)
                        }}
                      >
                        <SelectTrigger className="w-36 text-xs">
                          <SelectValue placeholder="Load preset" />
                        </SelectTrigger>
                        <SelectContent>
                          {presets.map((p) => (
                            <SelectItem key={p.raw_id} value={p.raw_id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (optionFields.length >= OPTION_LIMIT) {
                          toast.error(
                            `Maximum ${OPTION_LIMIT} option dimensions allowed`
                          )
                          return
                        }
                        appendOption({
                          name: "",
                          values: [{ name: "", km_markup: 0 }],
                        })
                      }}
                    >
                      <PlusIcon className="mr-1 size-3.5" />
                      Add option
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {optionFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No options defined. Single-variation products skip this
                    section.
                  </p>
                )}
                {optionFields.map((field, optIdx) => (
                  <OptionRow
                    key={field.id}
                    optIdx={optIdx}
                    form={form}
                    onRemove={() => removeOption(optIdx)}
                  />
                ))}
                {variationCountExceeded && (
                  <p className="text-sm text-destructive">
                    Too many combinations (
                    {watchedOptions.reduce(
                      (a, o) => a * Math.max(1, o.values.length),
                      1
                    )}{" "}
                    of {VARIATION_LIMIT} max). Reduce option values.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Variations preview */}
            {variations.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Variations ({variations.length})</CardTitle>
                  <CardDescription>
                    Auto-generated from your options. Prices are base + markups.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Computed price</TableHead>
                        <TableHead>Override price</TableHead>
                        <TableHead>Inventory</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variations.map((v) => (
                        <TableRow key={v.optionKey}>
                          <TableCell className="font-medium">
                            {v.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatCents(v.price)}
                          </TableCell>
                          <TableCell>
                            <DollarInput
                              allowEmpty
                              placeholder={formatCents(v.price)}
                              className="h-8 w-28 text-sm"
                              value={variationOverrides[v.optionKey]}
                              onChange={(cents) => {
                                setVariationOverrides((prev) => {
                                  if (cents === undefined) {
                                    const next = { ...prev }
                                    delete next[v.optionKey]
                                    return next
                                  }
                                  return { ...prev, [v.optionKey]: cents }
                                })
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="0"
                              className="h-8 w-24 text-sm"
                              value={variationInventory[v.optionKey] ?? ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value || "0", 10)
                                setVariationInventory((prev) => ({
                                  ...prev,
                                  [v.optionKey]: val,
                                }))
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Modifiers */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>Modifiers</CardTitle>
                    <CardDescription>
                      Add-ons customers select at checkout. Each list can be
                      single or multiple choice.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (modifierListFields.length >= MODIFIER_LIST_LIMIT) {
                        toast.error(
                          `Maximum ${MODIFIER_LIST_LIMIT} modifier lists allowed`
                        )
                        return
                      }
                      appendModifierList({
                        name: "",
                        selection_type: "SINGLE",
                        modifiers: [{ name: "", price_cents: 0 }],
                      })
                    }}
                  >
                    <PlusIcon className="mr-1 size-3.5" />
                    Add modifier list
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {modifierListFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No modifiers defined. Modifiers let customers customize
                    their order at checkout.
                  </p>
                )}
                {modifierListFields.map((field, mlIdx) => (
                  <ModifierListRow
                    key={field.id}
                    mlIdx={mlIdx}
                    form={form}
                    onRemove={() => removeModifierList(mlIdx)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Published">Published</SelectItem>
                            <SelectItem value="Draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2 pt-2">
                  <FormField
                    control={form.control}
                    name="available_online"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="cursor-pointer font-normal">
                          Available online
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allow_product_note"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="cursor-pointer font-normal">
                          Allow order note
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allow_product_personalization"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="cursor-pointer font-normal">
                          Allow personalization
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="allowed_fulfillments"
                  render={({ field }) => {
                    const selected = parseFulfillments(field.value)
                    return (
                      <FormItem>
                        <FormLabel>Fulfillment methods</FormLabel>
                        <div className="space-y-2">
                          {FULFILLMENT_OPTIONS.map((option) => {
                            const checked = selected.includes(option.value)
                            return (
                              <label
                                key={option.value}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const next = value
                                      ? [...selected, option.value]
                                      : selected.filter(
                                          (item) => item !== option.value
                                        )
                                    field.onChange(buildFulfillments(next))
                                  }}
                                />
                                <span>{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="category_ids"
                  render={({ field }) => (
                    <FormItem>
                      {categories.length > 0 && (
                        <Command className="mb-3 rounded-lg border">
                          <CommandInput
                            placeholder="Search categories..."
                            value={categorySearch}
                            onValueChange={setCategorySearch}
                          />
                          <CommandList className="hidden" />
                          <CommandEmpty className="hidden" />
                        </Command>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {filteredCategories.map((cat) => {
                          const selected = field.value.includes(cat.raw_id)
                          return (
                            <button
                              key={cat.raw_id}
                              type="button"
                              onClick={() => {
                                field.onChange(
                                  selected
                                    ? field.value.filter(
                                        (id) => id !== cat.raw_id
                                      )
                                    : [...field.value, cat.raw_id]
                                )
                              }}
                              className="rounded-full"
                            >
                              <Badge variant={selected ? "default" : "outline"}>
                                {cat.category_data.name}
                              </Badge>
                            </button>
                          )
                        })}
                        {categories.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No categories yet.
                          </p>
                        )}
                        {categories.length > 0 &&
                          filteredCategories.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No categories match your search.
                            </p>
                          )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Product images</CardTitle>
                <CardDescription>
                  Upload photos to showcase your product. The first image is the
                  cover.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="image_urls"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <SquareProductImageGallery
                          images={field.value}
                          onChange={field.onChange}
                          disabled={aiImageLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                <p className="text-xs text-muted-foreground">
                  Generate with AI
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    ["dramatic", "close_up", "environment", "flat_lay"] as const
                  ).map((style) => (
                    <Button
                      key={style}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={aiImageLoading || !form.getValues("name")}
                      onClick={() => handleAiImage(style)}
                      className="text-xs"
                    >
                      <ImageIcon className="mr-1 size-3" />
                      {style.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || variationCountExceeded}>
            {saving ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>

      {/* AI description dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI description suggestions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {aiDescriptions.map((desc, i) => (
              <button
                key={i}
                type="button"
                className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => {
                  form.setValue("description_html", desc)
                  setAiDialogOpen(false)
                  toast.success("Description applied")
                }}
              >
                {desc}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  )
}

// ─── Option row sub-component ─────────────────────────────────────────────────

function OptionRow({
  optIdx,
  form,
  onRemove,
}: {
  optIdx: number
  form: ReturnType<typeof useForm<FormValues>>
  onRemove: () => void
}) {
  const {
    fields: valueFields,
    append: appendValue,
    remove: removeValue,
  } = useFieldArray({ control: form.control, name: `options.${optIdx}.values` })

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <FormField
          control={form.control}
          name={`options.${optIdx}.name`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input placeholder="Option name (e.g. Size)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0 text-destructive"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_120px_32px] gap-2 px-1">
          <p className="text-xs text-muted-foreground">Value</p>
          <p className="text-xs text-muted-foreground">Price markup ($)</p>
          <span />
        </div>
        {valueFields.map((vField, vIdx) => (
          <div
            key={vField.id}
            className="grid grid-cols-[1fr_120px_32px] items-start gap-2"
          >
            <FormField
              control={form.control}
              name={`options.${optIdx}.values.${vIdx}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="e.g. Small"
                      {...field}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`options.${optIdx}.values.${vIdx}.km_markup`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeValue(vIdx)}
            >
              <Trash2Icon className="size-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            if (valueFields.length >= OPTION_VALUE_LIMIT) {
              toast.error(`Maximum ${OPTION_VALUE_LIMIT} values per option`)
              return
            }
            appendValue({ name: "", km_markup: 0 })
          }}
        >
          <PlusIcon className="mr-1 size-3" />
          Add value
        </Button>
      </div>
    </div>
  )
}

// ─── Modifier list row ────────────────────────────────────────────────────────

function ModifierListRow({
  mlIdx,
  form,
  onRemove,
}: {
  mlIdx: number
  form: ReturnType<typeof useForm<FormValues>>
  onRemove: () => void
}) {
  const {
    fields: modFields,
    append: appendMod,
    remove: removeMod,
  } = useFieldArray({
    control: form.control,
    name: `modifier_lists.${mlIdx}.modifiers`,
  })

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <FormField
          control={form.control}
          name={`modifier_lists.${mlIdx}.name`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  placeholder="Modifier list name (e.g. Add-ons)"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`modifier_lists.${mlIdx}.selection_type`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="w-28 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Single</SelectItem>
                    <SelectItem value="MULTIPLE">Multiple</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0 text-destructive"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_100px_32px] gap-2 px-1">
          <p className="text-xs text-muted-foreground">Modifier name</p>
          <p className="text-xs text-muted-foreground">Price add-on</p>
          <span />
        </div>
        {modFields.map((mField, mIdx) => (
          <div
            key={mField.id}
            className="grid grid-cols-[1fr_100px_32px] items-start gap-2"
          >
            <FormField
              control={form.control}
              name={`modifier_lists.${mlIdx}.modifiers.${mIdx}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="e.g. Extra cheese"
                      {...field}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`modifier_lists.${mlIdx}.modifiers.${mIdx}.price_cents`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <DollarInput
                        className="h-8 pl-5 text-sm"
                        value={field.value ?? 0}
                        onChange={(cents) => field.onChange(cents ?? 0)}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeMod(mIdx)}
            >
              <Trash2Icon className="size-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => appendMod({ name: "", price_cents: 0 })}
        >
          <PlusIcon className="mr-1 size-3" />
          Add modifier
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  SquareMirrorCategory,
  SquareMirrorProduct,
} from "@/lib/square/types"

const schema = z
  .object({
    name: z.string().min(1, "Discount name required").max(512),
    discount_type: z.enum(["percentage", "amount"]),
    percentage: z.coerce.number().min(0.01).max(100).optional(),
    amount: z.coerce.number().int().nonnegative().optional(),
    valid_from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    valid_until_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    valid_from_local_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
    valid_until_local_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
    product_ids: z.array(z.string()),
    category_ids: z.array(z.string()),
  })
  .refine(
    (d) =>
      d.discount_type === "percentage"
        ? d.percentage !== undefined
        : d.amount !== undefined,
    { message: "Either percentage or amount is required" }
  )
  .refine((d) => d.product_ids.length > 0 || d.category_ids.length > 0, {
    message: "Select at least one product or category to target",
  })

type FormValues = z.infer<typeof schema>

interface Props {
  products: SquareMirrorProduct[]
  categories: SquareMirrorCategory[]
}

export function SquareDiscountForm({ products, categories }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      discount_type: "percentage",
      valid_from_date: new Date().toISOString().slice(0, 10),
      valid_until_date: new Date(Date.now() + 30 * 86400 * 1000)
        .toISOString()
        .slice(0, 10),
      valid_from_local_time: "00:00",
      valid_until_local_time: "23:59",
      product_ids: [],
      category_ids: [],
    },
  })

  const discountType = form.watch("discount_type")
  const selectedProductIds = form.watch("product_ids")
  const selectedCategoryIds = form.watch("category_ids")

  function toggleProduct(id: string) {
    const current = form.getValues("product_ids")
    form.setValue(
      "product_ids",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    )
  }

  function toggleCategory(id: string) {
    const current = form.getValues("category_ids")
    form.setValue(
      "category_ids",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    )
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const payload = {
        name: values.name,
        discount:
          values.discount_type === "percentage"
            ? { percentage: values.percentage! }
            : { amount: values.amount! },
        product_ids: values.product_ids,
        category_ids: values.category_ids,
        pricing_rule: {
          valid_from_date: values.valid_from_date,
          valid_until_date: values.valid_until_date,
          valid_from_local_time: `${values.valid_from_local_time}:00`,
          valid_until_local_time: `${values.valid_until_local_time}:00`,
        },
      }

      const res = await fetch("/api/square/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")

      toast.success("Discount created")
      router.push("/square/discounts")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create discount"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle>Discount details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Summer Sale" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discount_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage
                              </SelectItem>
                              <SelectItem value="amount">
                                Fixed amount
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {discountType === "percentage" ? (
                    <FormField
                      control={form.control}
                      name="percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentage (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="10"
                                {...field}
                                className="pr-7"
                              />
                              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                                %
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (cents)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="number"
                                placeholder="0"
                                className="pl-7"
                                {...field}
                                value={
                                  field.value !== undefined
                                    ? (field.value / 100).toFixed(2)
                                    : ""
                                }
                                onChange={(e) =>
                                  field.onChange(
                                    Math.round(
                                      parseFloat(e.target.value || "0") * 100
                                    )
                                  )
                                }
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Validity window */}
            <Card>
              <CardHeader>
                <CardTitle>Valid window</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valid_from_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valid_until_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Until date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valid_from_local_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valid_until_local_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Until time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Target selection */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Target products</CardTitle>
                <CardDescription>
                  Select which products this discount applies to.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto">
                  {products.map((p) => (
                    <button
                      key={p.raw_id}
                      type="button"
                      onClick={() => toggleProduct(p.raw_id)}
                      className="rounded-full"
                    >
                      <Badge
                        variant={
                          selectedProductIds.includes(p.raw_id)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                      >
                        {p.item_data.name}
                      </Badge>
                    </button>
                  ))}
                  {products.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No products available.
                    </p>
                  )}
                </div>
                {form.formState.errors.product_ids && (
                  <p className="mt-2 text-sm text-destructive">
                    {form.formState.errors.product_ids.message}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Target categories</CardTitle>
                <CardDescription>
                  Or apply to an entire category.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.raw_id}
                      type="button"
                      onClick={() => toggleCategory(c.raw_id)}
                      className="rounded-full"
                    >
                      <Badge
                        variant={
                          selectedCategoryIds.includes(c.raw_id)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                      >
                        {c.category_data.name}
                      </Badge>
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No categories available.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create discount"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { SquareMirrorCategory } from "@/lib/square/types"

const schema = z.object({
  name: z.string().min(1, "Category name required").max(512),
  description_html: z.string().max(65535).optional(),
  image_url: z.string().url("Invalid image URL").optional().or(z.literal("")),
  status: z.enum(["Published", "Draft", "Featured"]),
  available_online: z.boolean(),
  available_from_date: z.string().optional(),
  available_until_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  initial?: SquareMirrorCategory
  submitLabel?: string
}

export function SquareCategoryForm({
  initial,
  submitLabel = "Save category",
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.category_data.name ?? "",
      description_html: initial?.category_data.description_html ?? "",
      image_url: initial?.category_data.image_urls?.[0] ?? "",
      status:
        (initial?.km_status as "Published" | "Draft" | "Featured") ?? "Draft",
      available_online: initial?.category_data.online_visibility ?? true,
      available_from_date: initial?.category_data.km_available_from_date ?? "",
      available_until_date:
        initial?.category_data.km_available_until_date ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const payload = {
        name: values.name,
        description_html: values.description_html,
        image_url: values.image_url || undefined,
        status: values.status,
        available_online: values.available_online,
        available_from_date: values.available_from_date || undefined,
        available_until_date: values.available_until_date || undefined,
      }

      const isEdit = Boolean(initial?.raw_id)
      const url = isEdit
        ? `/api/square/categories/${initial!.raw_id}`
        : "/api/square/categories"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")

      toast.success(isEdit ? "Category updated" : "Category created")
      router.push("/square/categories")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Category details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Desserts" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Describe this category..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Availability window</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="available_from_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available from</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
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
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
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
                            <SelectItem value="Featured">Featured</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="available_online"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel className="font-normal">
                        Visible online
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
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}

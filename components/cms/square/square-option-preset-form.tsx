"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { OPTION_VALUE_LIMIT } from "@/lib/validation/square.schema"

const schema = z.object({
  name: z.string().min(1, "Preset name required").max(512),
  option_name: z.string().min(1, "Option dimension name required").max(255),
  values: z
    .array(
      z.object({
        name: z.string().min(1, "Value name required").max(255),
        km_markup: z.coerce.number().min(-10000).max(10000),
      })
    )
    .min(1, "At least one value required")
    .max(OPTION_VALUE_LIMIT),
})

type FormValues = z.infer<typeof schema>

export function SquareOptionPresetForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      option_name: "",
      values: [{ name: "", km_markup: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "values",
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const payload = {
        name: values.name,
        option: {
          item_option_data: {
            name: values.option_name,
            values: values.values.map((v, i) => ({
              item_option_value_data: {
                name: v.name,
                ordinal: i,
                km_markup: v.km_markup,
                item_option_id: "",
              },
            })),
          },
        },
      }

      const res = await fetch("/api/square/option-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")

      toast.success("Option preset created")
      router.push("/square/options")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create preset"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-xl space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Option preset</CardTitle>
            <CardDescription>
              Build a reusable option template you can load into the product
              builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preset name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. T-Shirt Sizes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="option_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Option dimension</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Size" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="mb-2 grid grid-cols-[1fr_120px_32px] gap-2 px-1">
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-xs text-muted-foreground">
                  Price markup ($)
                </p>
                <span />
              </div>
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_120px_32px] items-start gap-2"
                  >
                    <FormField
                      control={form.control}
                      name={`values.${i}.name`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="e.g. Small"
                              {...f}
                              className="h-8 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`values.${i}.km_markup`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...f}
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
                      onClick={() => remove(i)}
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
                    if (fields.length >= OPTION_VALUE_LIMIT) {
                      toast.error(
                        `Maximum ${OPTION_VALUE_LIMIT} values per option`
                      )
                      return
                    }
                    append({ name: "", km_markup: 0 })
                  }}
                >
                  <PlusIcon className="mr-1 size-3" />
                  Add value
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create preset"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

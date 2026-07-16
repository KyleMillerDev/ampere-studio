"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

type StatusData = {
  connected: boolean
  location_id?: string
  environment?: string
  redirect_url?: string
}

const schema = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().min(10),
  environment: z.enum(["production", "sandbox"]),
  redirect_url: z.string().url(),
  location_id: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

interface Props {
  status: StatusData
}

export function SquareOAuthForm({ status }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      access_token: "",
      refresh_token: "",
      environment: "production",
      redirect_url: status.redirect_url ?? "",
      location_id: status.location_id ?? "",
      client_id: "",
      client_secret: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const res = await fetch("/api/square/oauth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to connect")
      toast.success("Square connected successfully")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection status
            <Badge variant={status.connected ? "default" : "secondary"}>
              {status.connected ? "Connected" : "Not connected"}
            </Badge>
          </CardTitle>
          {status.connected && (
            <CardDescription>
              Location: {status.location_id} ({status.environment})
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Square credentials</CardTitle>
          <CardDescription>
            Paste your Square OAuth tokens. These are stored securely in AWS
            Secrets Manager at {"{client_id}"}/square.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="environment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Environment</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">
                              Production
                            </SelectItem>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. D6C4CQGBHFPGD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="access_token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="EAAAlr..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="refresh_token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refresh token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="EQAAlv..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Square client ID</FormLabel>
                      <FormControl>
                        <Input placeholder="sq0idp-..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Square client secret</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="sq0csp-..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="redirect_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Redirect URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save credentials"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

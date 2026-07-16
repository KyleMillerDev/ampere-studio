"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserAdd01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClientOption } from "@/lib/cms/clients"

interface DevInviteUserDialogProps {
  activeClientId: string
  clients: ClientOption[]
}

export function DevInviteUserDialog({
  activeClientId,
  clients,
}: DevInviteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState(activeClientId)
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) setClientId(activeClientId)
  }, [activeClientId, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !clientId) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/dev/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          client_id: clientId,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        throw new Error(body.error ?? "Could not send invite")
      }

      const client = clients.find((item) => item.client_id === clientId)
      toast.success(
        `Invite sent to ${email.trim().toLowerCase()}${client ? ` for ${client.name}` : ""}`
      )
      setEmail("")
      setOpen(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={clients.length === 0}
        >
          <HugeiconsIcon icon={UserAdd01Icon} className="size-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Create a Cognito account and email temporary login credentials.
              They will set a new password on first sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-client">Client</Label>
              <Select
                value={clientId}
                onValueChange={setClientId}
                disabled={isSubmitting || clients.length === 0}
              >
                <SelectTrigger id="invite-client" className="w-full">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Clients</SelectLabel>
                    {clients.map((client) => (
                      <SelectItem
                        key={client.client_id}
                        value={client.client_id}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{client.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {client.client_id}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

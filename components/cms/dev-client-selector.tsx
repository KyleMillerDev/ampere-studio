"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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

interface DevClientSelectorProps {
  activeClientId: string
  clients: ClientOption[]
}

export function DevClientSelector({
  activeClientId,
  clients,
}: DevClientSelectorProps) {
  const router = useRouter()
  const [selectedClientId, setSelectedClientId] = useState(activeClientId)
  const [isSwitching, setIsSwitching] = useState(false)

  useEffect(() => {
    setSelectedClientId(activeClientId)
  }, [activeClientId])

  async function switchClient(clientId: string) {
    if (clientId === selectedClientId) return

    const previousClientId = selectedClientId
    const client = clients.find((item) => item.client_id === clientId)
    setSelectedClientId(clientId)
    setIsSwitching(true)

    try {
      const res = await fetch("/api/dev/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Could not switch client")
      }

      toast.success(`Viewing as ${client?.name ?? clientId}`)
      router.refresh()
    } catch (err) {
      setSelectedClientId(previousClientId)
      toast.error((err as Error).message)
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
        Viewing as
      </span>
      <Select
        value={selectedClientId}
        onValueChange={switchClient}
        disabled={isSwitching || clients.length === 0}
      >
        <SelectTrigger size="sm" className="w-[220px] bg-background">
          <SelectValue placeholder="Select client" />
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[260px]">
          <SelectGroup>
            <SelectLabel>Development clients</SelectLabel>
            {clients.map((client) => (
              <SelectItem key={client.client_id} value={client.client_id}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{client.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {client.client_id}
                  </span>
                </span>
              </SelectItem>
            ))}
            {clients.length === 0 ? (
              <SelectItem value="no-clients" disabled>
                No clients found
              </SelectItem>
            ) : null}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

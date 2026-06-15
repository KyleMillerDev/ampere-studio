"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PriceFields,
  emptyPriceDraft,
  priceDraftToInput,
  type PriceDraft,
} from "@/components/cms/stripe/price-fields"
import { formatStripeAmount } from "@/lib/utils"
import type { StripePriceView } from "@/lib/validation/stripe-product.schema"

function recurrenceLabel(price: StripePriceView): string {
  if (price.type !== "recurring" || !price.interval) return "One-time"
  const every =
    price.intervalCount && price.intervalCount > 1
      ? `every ${price.intervalCount} ${price.interval}s`
      : `every ${price.interval}`
  return `Recurring, ${every}`
}

interface PricesCardProps {
  productId: string
  prices: StripePriceView[]
}

export function PricesCard({ productId, prices }: PricesCardProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<PriceDraft>(emptyPriceDraft)
  const [saving, setSaving] = useState(false)

  async function createPrice() {
    const result = priceDraftToInput(draft)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setSaving(true)
    const res = await fetch(`/api/stripe/products/${productId}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.input),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Could not create price")
      return
    }
    toast.success("Price created")
    setDialogOpen(false)
    setDraft(emptyPriceDraft)
    router.refresh()
  }

  async function setDefault(priceId: string) {
    const res = await fetch(`/api/stripe/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPriceId: priceId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Could not set default price")
      return
    }
    toast.success("Default price updated")
    router.refresh()
  }

  async function setActive(priceId: string, active: boolean) {
    const res = await fetch(`/api/stripe/prices/${priceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Could not update price")
      return
    }
    toast.success(active ? "Price reactivated" : "Price archived")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Prices</CardTitle>
          <CardDescription>
            All prices attached to this product in Stripe.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
          New price
        </Button>
      </CardHeader>
      <CardContent>
        {prices.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No prices yet. Add one so this product can be sold.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Nickname</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((price) => (
                <TableRow key={price.id}>
                  <TableCell className="font-medium">
                    {formatStripeAmount(price.unitAmount, price.currency)}
                    {price.isDefault ? (
                      <Badge variant="secondary" className="ml-2">
                        Default
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{recurrenceLabel(price)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {price.nickname || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={price.active ? "default" : "outline"}>
                      {price.active ? "active" : "archived"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Price actions"
                          >
                            <HugeiconsIcon
                              icon={MoreHorizontalIcon}
                              className="size-4"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {price.active && !price.isDefault ? (
                            <DropdownMenuItem
                              onClick={() => setDefault(price.id)}
                            >
                              Set as default
                            </DropdownMenuItem>
                          ) : null}
                          {price.active ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setActive(price.id, false)}
                            >
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setActive(price.id, true)}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New price</DialogTitle>
            <DialogDescription>
              Add a one-time or recurring price to this product.
            </DialogDescription>
          </DialogHeader>
          <PriceFields draft={draft} onChange={setDraft} idPrefix="new-price" />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={createPrice} disabled={saving}>
              {saving ? "Creating..." : "Create price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

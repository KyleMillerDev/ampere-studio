"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  Delete02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatStripeAmount } from "@/lib/utils"
import type { OrderView } from "@/lib/stripe/orders"
import type { CatalogProduct } from "@/lib/stripe/catalog"

interface EditorItem {
  ref: string
  name: string
  image: string | null
  quantity: number
  unitAmount: number
}

function orderItemsToEditorItems(order: OrderView): EditorItem[] {
  return order.lineItems.map((item) => ({
    ref: item.ref,
    name: item.name,
    image: item.image,
    quantity: item.quantity,
    unitAmount: item.unitAmount ?? 0,
  }))
}

interface OrderEditorProps {
  order: OrderView
  catalogProducts: CatalogProduct[]
}

export function OrderEditor({ order, catalogProducts }: OrderEditorProps) {
  const router = useRouter()
  const [items, setItems] = useState<EditorItem[]>(
    orderItemsToEditorItems(order)
  )
  const [discountCents, setDiscountCents] = useState(0)
  const [discountInput, setDiscountInput] = useState("")
  const [addProductId, setAddProductId] = useState("")
  const [loading, setLoading] = useState(false)

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.unitAmount * i.quantity, 0),
    [items]
  )
  const shippingCost = order.shippingCost ?? 0
  const newTotal = Math.max(0, subtotal + shippingCost - discountCents)
  const delta = newTotal - order.amount

  function updateQty(ref: string, qty: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.ref === ref ? { ...i, quantity: Math.max(1, qty) } : i
      )
    )
  }

  function removeItem(ref: string) {
    setItems((prev) => prev.filter((i) => i.ref !== ref))
  }

  function addProduct() {
    const product = catalogProducts.find((p) => p.id === addProductId)
    if (!product || product.unitAmount === null) return
    setItems((prev) => {
      const existing = prev.find((i) => i.ref === product.id)
      if (existing) {
        return prev.map((i) =>
          i.ref === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          ref: product.id,
          name: product.name,
          image: product.image,
          quantity: 1,
          unitAmount: product.unitAmount!,
        },
      ]
    })
    setAddProductId("")
  }

  function handleDiscountChange(raw: string) {
    setDiscountInput(raw)
    const parsed = parseFloat(raw)
    setDiscountCents(isNaN(parsed) ? 0 : Math.round(parsed * 100))
  }

  async function handleSave() {
    if (items.length === 0) {
      toast.error("At least one item is required.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/stripe/orders/${order.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            ref: i.ref,
            quantity: i.quantity,
            unitAmount: i.unitAmount,
          })),
          discountAmount: discountCents,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Save failed")
      }

      if (delta > 0) {
        toast.success(
          "Order updated. A Stripe Invoice has been sent to the customer for the balance due."
        )
      } else if (delta < 0) {
        toast.success(
          `Order updated. A refund of ${formatStripeAmount(Math.abs(delta), order.currency)} has been issued.`
        )
      } else {
        toast.success("Order updated.")
      }

      router.push(`/orders/${order.id}`)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setLoading(false)
    }
  }

  const availableToAdd = catalogProducts.filter((p) => p.unitAmount !== null)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No items. Add at least one product.
              </p>
            )}
            {items.map((item) => (
              <div key={item.ref} className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={Image01Icon}
                      className="size-4 text-muted-foreground"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatStripeAmount(item.unitAmount, order.currency)} each
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateQty(item.ref, parseInt(e.target.value, 10) || 1)
                  }
                  className="w-20 text-center"
                />
                <p className="w-20 text-right text-sm font-semibold">
                  {formatStripeAmount(
                    item.unitAmount * item.quantity,
                    order.currency
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.ref)}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                </Button>
              </div>
            ))}

            <Separator />

            {/* Add product */}
            <div className="flex gap-2">
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({formatStripeAmount(p.unitAmount!, "usd")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={addProduct}
                disabled={!addProductId}
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Discount */}
        <Card>
          <CardHeader>
            <CardTitle>Discount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="discount">Discount amount (USD)</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                step={0.01}
                value={discountInput}
                onChange={(e) => handleDiscountChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Totals sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatStripeAmount(subtotal, order.currency)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>Discount</span>
                <span>
                  -{formatStripeAmount(discountCents, order.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>{formatStripeAmount(shippingCost, order.currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>New total</span>
              <span>{formatStripeAmount(newTotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Original total</span>
              <span>{formatStripeAmount(order.amount, order.currency)}</span>
            </div>

            {delta !== 0 && (
              <div
                className={`mt-2 rounded-md border px-3 py-2 text-xs ${
                  delta < 0
                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                }`}
              >
                {delta < 0 ? (
                  <>
                    A partial refund of{" "}
                    <strong>
                      {formatStripeAmount(Math.abs(delta), order.currency)}
                    </strong>{" "}
                    will be issued automatically.
                  </>
                ) : (
                  <>
                    The customer will be sent a Stripe Invoice for the
                    additional{" "}
                    <strong>{formatStripeAmount(delta, order.currency)}</strong>
                    .
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button onClick={handleSave} disabled={loading || items.length === 0}>
            {loading ? "Saving…" : "Save changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

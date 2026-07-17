"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { OrderView, TrackingCarrier } from "@/lib/stripe/orders"

type DialogType = "tracking" | "receipt" | "status" | "refund" | "cancel" | null

interface OrderActionsProps {
  order: OrderView
}

export function OrderActions({ order }: OrderActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState<DialogType>(null)
  const [loading, setLoading] = useState(false)

  // Tracking state
  const [tracking, setTracking] = useState(order.tracking ?? "")
  const [carrier, setCarrier] = useState<TrackingCarrier>(
    order.trackingCarrier ?? "USPS"
  )
  const [notifyCustomer, setNotifyCustomer] = useState(true)

  // Receipt state
  const [receiptTo, setReceiptTo] = useState(order.customerEmail ?? "")
  const [bccInputs, setBccInputs] = useState<string[]>([])

  // Status state
  const [statusOverride, setStatusOverride] = useState(
    order.statusOverride ?? ""
  )

  // Refund state
  const [refundType, setRefundType] = useState<"full" | "custom">("full")
  const [customAmount, setCustomAmount] = useState("")

  // Cancel state
  const [cancelRefund, setCancelRefund] = useState(true)

  async function post(path: string, body: unknown) {
    const res = await fetch(`/api/stripe/orders/${order.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? "Request failed")
    }
    return res.json()
  }

  async function handleTracking() {
    if (!tracking.trim()) {
      toast.error("Please enter a tracking number.")
      return
    }
    setLoading(true)
    try {
      await post("tracking", {
        tracking: tracking.trim(),
        tracking_carrier: carrier,
        notify_customer: notifyCustomer,
      })
      toast.success("Tracking added.")
      setOpen(null)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add tracking.")
    } finally {
      setLoading(false)
    }
  }

  async function handleReceipt() {
    if (!receiptTo.trim()) {
      toast.error("Please enter a recipient email.")
      return
    }
    setLoading(true)
    try {
      await post("receipt", {
        to: receiptTo.trim(),
        bcc: bccInputs.filter(Boolean),
      })
      toast.success("Receipt sent.")
      setOpen(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send receipt.")
    } finally {
      setLoading(false)
    }
  }

  async function handleStatus() {
    setLoading(true)
    try {
      await post("status", { status_override: statusOverride })
      toast.success("Status updated.")
      setOpen(null)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update status.")
    } finally {
      setLoading(false)
    }
  }

  async function handleRefund() {
    setLoading(true)
    try {
      const body: { amount?: number } = {}
      if (refundType === "custom") {
        const cents = Math.round(parseFloat(customAmount) * 100)
        if (!cents || isNaN(cents)) {
          toast.error("Enter a valid refund amount.")
          setLoading(false)
          return
        }
        body.amount = cents
      }
      await post("refund", body)
      toast.success("Refund issued.")
      setOpen(null)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Refund failed.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    setLoading(true)
    try {
      await post("cancel", { refund: cancelRefund })
      toast.success("Order cancelled.")
      setOpen(null)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Cancel failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Order actions">
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/orders/${order.id}`}>View Order</Link>
          </DropdownMenuItem>
          {order.status !== "Failed" && (
            <>
              <DropdownMenuItem onSelect={() => setOpen("tracking")}>
                Add Tracking
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/orders/${order.id}/edit`}>Edit Order</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpen("receipt")}>
                Send receipt
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpen("status")}>
                Change Status
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem asChild>
            <a href={`mailto:${order.customerEmail ?? ""}`}>Email Customer</a>
          </DropdownMenuItem>
          {order.status !== "Failed" && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-xs font-semibold text-destructive">
                Danger Zone
              </div>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setOpen("refund")}
              >
                Refund Order
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setOpen("cancel")}
              >
                Cancel Order
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Tracking */}
      <Dialog open={open === "tracking"} onOpenChange={() => setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking</DialogTitle>
            <DialogDescription>
              Order #{order.confirmationNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tracking-number">Tracking number</Label>
              <Input
                id="tracking-number"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="1Z999AA10123456784"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carrier">Carrier</Label>
              <Select
                value={carrier}
                onValueChange={(v) => setCarrier(v as TrackingCarrier)}
              >
                <SelectTrigger id="carrier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FEDEX">FedEx</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-customer"
                checked={notifyCustomer}
                onCheckedChange={(v) => setNotifyCustomer(v === true)}
              />
              <Label htmlFor="notify-customer" className="cursor-pointer">
                Notify customer of shipment
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={handleTracking} disabled={loading}>
              {loading ? "Saving…" : "Save tracking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Receipt */}
      <Dialog open={open === "receipt"} onOpenChange={() => setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Receipt</DialogTitle>
            <DialogDescription>
              Order #{order.confirmationNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-to">Recipient</Label>
              <Input
                id="receipt-to"
                type="email"
                value={receiptTo}
                onChange={(e) => setReceiptTo(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            {bccInputs.map((bcc, i) => (
              <div key={i} className="space-y-1.5">
                <Label>BCC {i + 1}</Label>
                <Input
                  type="email"
                  value={bcc}
                  onChange={(e) => {
                    const next = [...bccInputs]
                    next[i] = e.target.value
                    setBccInputs(next)
                  }}
                  placeholder="bcc@example.com"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBccInputs([...bccInputs, ""])}
            >
              + Add BCC
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={handleReceipt} disabled={loading}>
              {loading ? "Sending…" : "Send receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status */}
      <Dialog open={open === "status"} onOpenChange={() => setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Override the derived status for order #{order.confirmationNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="status-override">Status override</Label>
            <Select value={statusOverride} onValueChange={setStatusOverride}>
              <SelectTrigger id="status-override">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (auto-derive)</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={handleStatus} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Order */}
      <Dialog open={open === "refund"} onOpenChange={() => setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Order</DialogTitle>
            <DialogDescription>
              Order #{order.confirmationNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value="full"
                  checked={refundType === "full"}
                  onChange={() => setRefundType("full")}
                />
                Full refund
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value="custom"
                  checked={refundType === "custom"}
                  onChange={() => setRefundType("custom")}
                />
                Custom amount
              </label>
            </div>
            {refundType === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="refund-amount">Amount (USD)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={loading}
            >
              {loading ? "Processing…" : "Issue refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order */}
      <Dialog open={open === "cancel"} onOpenChange={() => setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This will mark order #{order.confirmationNumber} as cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={cancelRefund}
                onChange={() => setCancelRefund(true)}
              />
              Refund order
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={!cancelRefund}
                onChange={() => setCancelRefund(false)}
              />
              No refund
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? "Cancelling…" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

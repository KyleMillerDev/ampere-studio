"use client"

import { Badge } from "@/components/ui/badge"
import type { OrderStatus } from "@/lib/stripe/orders"

const STATUS_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Paid: "secondary",
  Shipped: "default",
  Complete: "default",
  Cancelled: "outline",
  Refunded: "outline",
  "Partially Refunded": "outline",
  Disputed: "destructive",
  Failed: "destructive",
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  Paid: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  Shipped:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  Complete:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  Cancelled: "text-muted-foreground",
  Refunded:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
  "Partially Refunded":
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  Disputed:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  Failed:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
}

interface OrderStatusBadgeProps {
  status: OrderStatus
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={STATUS_CLASS[status]}>
      {status}
    </Badge>
  )
}

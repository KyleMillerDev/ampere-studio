"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert01Icon,
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  CreditCardIcon,
  DeliveryTruck01Icon,
  Flag01Icon,
  Loading03Icon,
  MoneyReceive01Icon,
  PencilEdit01Icon,
  SecurityCheckIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"

import { formatLocalFriendlyDateTime } from "@/lib/utils"
import type {
  OrderHistoryEvent,
  OrderHistoryKind,
} from "@/lib/stripe/order-model"

const HISTORY_ICONS = {
  payment_started: CreditCardIcon,
  pending_verification: SecurityCheckIcon,
  payment_processing: Loading03Icon,
  payment_authorized: Shield01Icon,
  payment_succeeded: CheckmarkCircle01Icon,
  payment_failed: Alert01Icon,
  payment_cancelled: CancelCircleIcon,
  refund: MoneyReceive01Icon,
  edited: PencilEdit01Icon,
  shipped: DeliveryTruck01Icon,
  disputed: Flag01Icon,
} satisfies Record<OrderHistoryKind, typeof CreditCardIcon>

interface OrderHistoryProps {
  events: OrderHistoryEvent[]
}

export function OrderHistory({ events }: OrderHistoryProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No history available.</p>
    )
  }

  return (
    <ul className="divide-y">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <HugeiconsIcon
              icon={HISTORY_ICONS[event.kind]}
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span className="text-sm text-foreground">{event.label}</span>
          </div>
          <time
            dateTime={new Date(event.created * 1000).toISOString()}
            className="shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground"
          >
            {formatLocalFriendlyDateTime(event.created)}
          </time>
        </li>
      ))}
    </ul>
  )
}

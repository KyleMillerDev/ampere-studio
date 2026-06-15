"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  StripePriceCreateInput,
  StripePriceView,
} from "@/lib/validation/stripe-product.schema"

export interface PriceDraft {
  currency: string
  /** Amount in minor units (cents), held as a string for free typing. */
  amount: string
  type: "one_time" | "recurring"
  interval: "day" | "week" | "month" | "year"
  intervalCount: string
  nickname: string
}

export const emptyPriceDraft: PriceDraft = {
  currency: "usd",
  amount: "",
  type: "one_time",
  interval: "month",
  intervalCount: "1",
  nickname: "",
}

/** Seed the price form from an existing Stripe price. */
export function priceViewToDraft(price: StripePriceView | null): PriceDraft {
  if (!price || price.unitAmount === null) return { ...emptyPriceDraft }
  return {
    currency: price.currency,
    amount: String(price.unitAmount),
    type: price.type,
    interval: price.interval ?? "month",
    intervalCount: String(price.intervalCount ?? 1),
    nickname: price.nickname ?? "",
  }
}

/** Whether billing fields differ from the price currently on the product. */
export function priceDraftMatchesView(
  draft: PriceDraft,
  view: StripePriceView
): boolean {
  if (view.unitAmount === null) return !draft.amount.trim()
  return (
    String(view.unitAmount) === draft.amount.trim() &&
    view.currency.toLowerCase() === draft.currency.trim().toLowerCase() &&
    view.type === draft.type &&
    (view.type !== "recurring" ||
      (view.interval === draft.interval &&
        String(view.intervalCount ?? 1) === draft.intervalCount.trim()))
  )
}

/** Validate a draft into API input. Returns an error message when invalid. */
export function priceDraftToInput(
  draft: PriceDraft
): { input: StripePriceCreateInput } | { error: string } {
  const currency = draft.currency.trim().toLowerCase()
  if (!/^[a-z]{3}$/.test(currency)) {
    return { error: "Currency must be a 3-letter code (e.g. usd)" }
  }
  const amount = Number(draft.amount)
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Amount must be a positive whole number of cents" }
  }
  const intervalCount = Number(draft.intervalCount) || 1
  return {
    input: {
      currency,
      unitAmount: amount,
      type: draft.type,
      ...(draft.type === "recurring"
        ? { interval: draft.interval, intervalCount }
        : {}),
      ...(draft.nickname.trim() ? { nickname: draft.nickname.trim() } : {}),
    },
  }
}

interface PriceFieldsProps {
  draft: PriceDraft
  onChange: (draft: PriceDraft) => void
  idPrefix: string
}

export function PriceFields({ draft, onChange, idPrefix }: PriceFieldsProps) {
  function patch(p: Partial<PriceDraft>) {
    onChange({ ...draft, ...p })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-amount`}>Amount (cents)</Label>
          <Input
            id={`${idPrefix}-amount`}
            inputMode="numeric"
            type="number"
            min={1}
            step={1}
            placeholder="1299"
            value={draft.amount}
            onChange={(e) => patch({ amount: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">$12.99 is 1299.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-currency`}>Currency</Label>
          <Input
            id={`${idPrefix}-currency`}
            maxLength={3}
            placeholder="usd"
            value={draft.currency}
            onChange={(e) => patch({ currency: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Billing</Label>
        <Select
          value={draft.type}
          onValueChange={(v) => patch({ type: v as PriceDraft["type"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one_time">One-time</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {draft.type === "recurring" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Interval</Label>
            <Select
              value={draft.interval}
              onValueChange={(v) =>
                patch({ interval: v as PriceDraft["interval"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-interval-count`}>Every</Label>
            <Input
              id={`${idPrefix}-interval-count`}
              inputMode="numeric"
              type="number"
              min={1}
              max={52}
              step={1}
              value={draft.intervalCount}
              onChange={(e) => patch({ intervalCount: e.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-nickname`}>Nickname</Label>
        <Input
          id={`${idPrefix}-nickname`}
          placeholder="Optional internal label"
          value={draft.nickname}
          onChange={(e) => patch({ nickname: e.target.value })}
        />
      </div>
    </div>
  )
}

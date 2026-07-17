"use client"

import { cn } from "@/lib/utils"
import type { OrderPaymentMethod } from "@/lib/stripe/order-model"

function BrandMark({
  brand,
  className,
}: {
  brand: string | null
  className?: string
}) {
  const key = (brand ?? "card").toLowerCase()
  const shell = cn(
    "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-[8px] font-bold tracking-tight text-white",
    className
  )

  if (key === "visa") {
    return (
      <span className={cn(shell, "bg-[#1A1F71]")} aria-hidden>
        <svg viewBox="0 0 32 20" className="h-3 w-5" fill="currentColor">
          <path d="M13.2 13.8h-2.1l1.3-8h2.1l-1.3 8zm8.7-7.8c-.4-.2-1.1-.4-1.9-.4-2.1 0-3.6 1.1-3.6 2.7 0 1.2 1.1 1.8 1.9 2.2.9.4 1.1.7 1.1 1.1 0 .6-.7.8-1.3.8-.9 0-1.4-.1-2.1-.4l-.3-.1-.3 1.9c.5.2 1.5.4 2.5.4 2.3 0 3.8-1.1 3.8-2.8 0-.9-.6-1.6-1.8-2.2-.8-.4-1.2-.6-1.2-1.1 0-.4.4-.7 1.3-.7.7 0 1.3.2 1.7.3l.2.1.3-1.8zm5.5-.2h-1.6c-.5 0-.9.1-1.1.6l-3.2 7.4h2.3l.4-1.2h2.8l.3 1.2h2l-1.9-8zm-2.7 5.2.9-2.5.1-.3.5 2.8h-1.5zM11 5.8l-2.2 8H6.5l-1.1-5.8c-.1-.3-.1-.4-.4-.6C4.5 7.2 3.7 7 3 6.8l.1-.5h3.5c.5 0 .9.3 1 .8l.8 4.3 2-5.1H11z" />
        </svg>
      </span>
    )
  }

  if (key === "mastercard") {
    return (
      <span className={cn(shell, "bg-[#111]")} aria-hidden>
        <svg viewBox="0 0 32 20" className="h-3.5 w-5">
          <circle cx="12" cy="10" r="6" fill="#EB001B" />
          <circle cx="20" cy="10" r="6" fill="#F79E1B" />
          <path d="M16 5.3a6 6 0 0 1 0 9.4 6 6 0 0 1 0-9.4z" fill="#FF5F00" />
        </svg>
      </span>
    )
  }

  if (key === "amex" || key === "american_express") {
    return (
      <span className={cn(shell, "bg-[#2E77BC] text-[7px]")} aria-hidden>
        AMEX
      </span>
    )
  }

  if (key === "discover") {
    return (
      <span className={cn(shell, "bg-[#FF6000] text-[6px]")} aria-hidden>
        DISC
      </span>
    )
  }

  if (key === "link") {
    return (
      <span className={cn(shell, "bg-[#00D66F]")} aria-hidden>
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
          <path
            d="M5 8h6M9 5l3 3-3 3"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }

  if (key === "paypal") {
    return (
      <span className={cn(shell, "bg-[#003087] text-[7px]")} aria-hidden>
        PP
      </span>
    )
  }

  if (key === "amazon_pay") {
    return (
      <span className={cn(shell, "bg-[#111] text-[6px]")} aria-hidden>
        pay
      </span>
    )
  }

  if (key === "affirm") {
    return (
      <span
        className={cn(shell, "bg-[#0B50D0] text-[8px] lowercase")}
        aria-hidden
      >
        a
      </span>
    )
  }

  if (key === "apple_pay") {
    return (
      <span className={cn(shell, "bg-black text-[6px]")} aria-hidden>
        Pay
      </span>
    )
  }

  if (key === "google_pay") {
    return (
      <span
        className={cn(
          shell,
          "bg-white text-[6px] text-[#3C4043] ring-1 ring-border"
        )}
        aria-hidden
      >
        GPay
      </span>
    )
  }

  return (
    <span className={cn(shell, "bg-muted text-muted-foreground")} aria-hidden>
      <svg viewBox="0 0 24 16" className="h-2.5 w-4" fill="currentColor">
        <rect x="1" y="2" width="22" height="12" rx="2" opacity="0.35" />
        <rect x="1" y="5" width="22" height="3" />
      </svg>
    </span>
  )
}

interface OrderPaymentMethodProps {
  paymentMethod: OrderPaymentMethod | null
  className?: string
}

export function OrderPaymentMethodCell({
  paymentMethod,
  className,
}: OrderPaymentMethodProps) {
  if (!paymentMethod) {
    return <span className={cn("text-muted-foreground", className)}>—</span>
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <BrandMark brand={paymentMethod.brand ?? paymentMethod.type} />
      <span className="truncate">{paymentMethod.label}</span>
    </span>
  )
}

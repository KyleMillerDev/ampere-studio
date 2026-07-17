import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + "…"
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

/** Format integer cents as USD currency (e.g. 1299 -> "$12.99"). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

/** Stripe currencies charged in whole units rather than minor units. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
])

/** Format a Stripe minor-unit amount with its currency (e.g. 1299 + "usd" -> "$12.99"). */
export function formatStripeAmount(
  amount: number | null | undefined,
  currency: string
): string {
  if (amount === null || amount === undefined) return "—"
  const code = currency.toLowerCase()
  const value = ZERO_DECIMAL_CURRENCIES.has(code) ? amount : amount / 100
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code.toUpperCase(),
    }).format(value)
  } catch {
    return `${value} ${code.toUpperCase()}`
  }
}

/** Format a unix-seconds timestamp as a short, human-friendly date. */
export function formatUnixDate(seconds: number | undefined): string {
  if (!seconds) return "—"
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** Format a unix-seconds timestamp with a short date and time. */
export function formatUnixDateTime(seconds: number | undefined): string {
  if (!seconds) return "—"
  return new Date(seconds * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Format an ISO date string as a short, human-friendly date. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

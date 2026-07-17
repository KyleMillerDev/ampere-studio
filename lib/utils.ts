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
  // US/Canada with leading country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
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

/**
 * Format unix seconds in the viewer's local timezone, e.g.
 * "Wed September 15, 2026, 11:00pm CST".
 */
export function formatLocalFriendlyDateTime(
  seconds: number | undefined
): string {
  if (!seconds) return "—"
  const d = new Date(seconds * 1000)
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" })
  const date = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    })
    .replace(/\s*(AM|PM)/i, (_, mer: string) => mer.toLowerCase())
  return `${weekday} ${date}, ${time}`
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

/**
 * Relative timestamp for recent activity lists, e.g.
 * "12 minutes ago", "3 hours ago", "Yesterday", "1 day ago", "Last week".
 */
export function formatRelativeTime(
  iso: string | undefined,
  now: Date = new Date()
): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return "Just now"

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  }

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (date >= startOfYesterday && date < startOfToday) {
    return "Yesterday"
  }

  const days = Math.floor(hours / 24)
  if (days === 1) return "1 day ago"
  if (days < 7) return `${days} days ago`
  if (days < 14) return "Last week"

  const weeks = Math.floor(days / 7)
  if (weeks < 5) {
    return weeks === 1 ? "Last week" : `${weeks} weeks ago`
  }

  const months = Math.floor(days / 30)
  if (months < 12) {
    return months <= 1 ? "Last month" : `${months} months ago`
  }

  const years = Math.floor(days / 365)
  return years <= 1 ? "Last year" : `${years} years ago`
}

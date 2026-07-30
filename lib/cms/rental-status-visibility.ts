export type RentalListingStatus = "active" | "rented"

export type RentalVisibilityTone = "visible" | "hidden"

export function getRentalVisibilityMessage(
  status: RentalListingStatus,
  options: {
    isEdit: boolean
    savedStatus?: RentalListingStatus | null
  }
): { text: string; tone: RentalVisibilityTone } {
  const isVisible = status === "active"
  const unchanged =
    options.isEdit &&
    options.savedStatus != null &&
    options.savedStatus === status

  if (isVisible) {
    return {
      tone: "visible",
      text: unchanged
        ? "Your rental is currently visible on your website."
        : "Your rental will be visible on your website.",
    }
  }

  return {
    tone: "hidden",
    text: unchanged
      ? "Your rental is currently not visible on your website."
      : "Your rental will not be visible on your website.",
  }
}

export function getRentalStatusCardClassName(
  status: RentalListingStatus
): string {
  if (status === "active") {
    return "border-2 border-green-600 ring-2 ring-green-600/40 dark:border-green-500 dark:ring-green-500/35"
  }

  return "border-2 border-red-900 ring-2 ring-red-900/40 dark:border-red-700 dark:ring-red-700/35"
}

export function getRentalVisibilityTextClassName(
  tone: RentalVisibilityTone
): string {
  if (tone === "visible") {
    return "text-green-700 dark:text-green-500"
  }

  return "text-red-900 dark:text-red-400"
}

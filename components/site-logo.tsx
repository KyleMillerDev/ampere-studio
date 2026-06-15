"use client"

import { cn } from "@/lib/utils"

/** Full wordmark: dark artwork on light UI, light artwork on dark UI */
const LOGO_FULL_LIGHT_MODE = "/assets/logos/Logo.svg"
const LOGO_FULL_DARK_MODE = "/assets/logos/Logo%20Light.svg"

/** Badge: dark on light UI, light on dark UI */
const BADGE_LIGHT_MODE = "/assets/logos/Badge%20Dark.svg"
const BADGE_DARK_MODE = "/assets/logos/Badge%20Light.svg"

type SiteLogoProps = {
  variant?: "full" | "badge" | "badgeOnPrimary" | "fullOnPrimary"
  className?: string
  imgClassName?: string
}

/**
 * Brand logos from /public/assets/logos — dark variants for light mode, light variants for dark mode.
 * `badgeOnPrimary` and `fullOnPrimary` use light artwork for saturated primary backgrounds.
 */
export function SiteLogo({
  variant = "full",
  className,
  imgClassName,
}: SiteLogoProps) {
  const baseImg = "block object-contain object-left"

  if (variant === "badgeOnPrimary") {
    return (
      <span
        role="img"
        aria-label="Ampere Creative Group"
        className={cn("inline-flex shrink-0", className)}
      >
        <img
          src={BADGE_DARK_MODE}
          alt=""
          className={cn(baseImg, "size-10", imgClassName)}
        />
      </span>
    )
  }

  if (variant === "fullOnPrimary") {
    return (
      <span
        role="img"
        aria-label="Ampere Creative Group"
        className={cn("inline-flex shrink-0 items-center", className)}
      >
        <img
          src={LOGO_FULL_DARK_MODE}
          alt=""
          className={cn(baseImg, "h-12 w-auto max-w-full", imgClassName)}
        />
      </span>
    )
  }

  if (variant === "badge") {
    return (
      <span
        role="img"
        aria-label="Ampere Creative Group"
        className={cn("inline-flex shrink-0", className)}
      >
        <img
          src={BADGE_LIGHT_MODE}
          alt=""
          className={cn(baseImg, "size-8 dark:hidden", imgClassName)}
        />
        <img
          src={BADGE_DARK_MODE}
          alt=""
          className={cn(baseImg, "hidden size-8 dark:block", imgClassName)}
        />
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label="Ampere Creative Group"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <img
        src={LOGO_FULL_LIGHT_MODE}
        alt=""
        className={cn(
          baseImg,
          "h-10 w-auto max-w-[min(100%,320px)] sm:h-11 md:h-12 dark:hidden",
          imgClassName
        )}
      />
      <img
        src={LOGO_FULL_DARK_MODE}
        alt=""
        className={cn(
          baseImg,
          "hidden h-10 w-auto max-w-[min(100%,320px)] sm:h-11 md:h-12 dark:block",
          imgClassName
        )}
      />
    </span>
  )
}

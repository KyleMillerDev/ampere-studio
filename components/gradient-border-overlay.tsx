"use client"

import { useRef, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useScrollProximity } from "@/hooks/use-scroll-proximity"

type GradientBorderOverlayProps = {
  mode?: "hover" | "always"
  /**
   * 0–1: when provided, overrides all automatic behaviour and drives border
   * opacity directly (e.g. an ancestor already tracking scroll proximity).
   */
  activeLevel?: number
  className?: string
}

/**
 * Drop inside any `relative` card to render the brand gradient outline.
 * - mode="hover": plain border at rest; gradient on group-hover (desktop) OR
 *   scroll-proximity (mobile, automatic, no props needed).
 * - mode="always": persistent gradient outline.
 * - activeLevel (0–1): bypasses all automatic logic, drives opacity directly.
 *
 * Uses rounded-[inherit] so it always matches the parent's border-radius.
 */
export function GradientBorderOverlay({
  mode = "hover",
  activeLevel,
  className,
}: GradientBorderOverlayProps) {
  // Attach a ref to the first rendered div; walk up to parentElement (the card)
  const innerRef = useRef<HTMLDivElement>(null)
  const parentRef = useMemo(
    () => ({ get current() { return innerRef.current?.parentElement ?? null } }),
    []
  )

  const scrollProximity = useScrollProximity(parentRef)

  // Determine the resolved active level:
  // - explicit prop wins
  // - otherwise use scroll proximity on mobile (non-zero only on mobile)
  const resolved = activeLevel !== undefined ? activeLevel : scrollProximity
  const isControlled = resolved > 0

  const hoverMode = mode === "hover"

  return (
    <>
      {/* Base border */}
      <div
        ref={innerRef}
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] border border-border transition-opacity duration-200 corner-squircle",
          hoverMode && !isControlled && "group-hover:opacity-0",
          className
        )}
        style={isControlled ? { opacity: 1 - resolved } : undefined}
      />
      {/* Gradient border */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200 corner-squircle",
          hoverMode && !isControlled && "opacity-0 group-hover:opacity-100",
          className
        )}
        style={{
          opacity: isControlled
            ? resolved
            : mode === "always"
              ? 1
              : undefined,
          padding: "2px",
          background: "var(--gradient-brand)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor" as const,
          maskComposite: "exclude" as const,
        }}
      />
    </>
  )
}

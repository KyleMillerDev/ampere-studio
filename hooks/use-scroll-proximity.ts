"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Returns a 0–1 proximity value representing how close the tracked element's
 * center is to the viewport center. Only active below the `lg` breakpoint
 * (mobile). Always returns 0 on desktop.
 *
 * @param ref         A ref to any element (or a child whose parentElement is
 *                    the element you want to track — pass a derived ref).
 * @param zoneFraction  Half-height of the "active zone" as a fraction of
 *                    viewport height (default 0.3 = ±30 vh).
 */
export function useScrollProximity(
  ref: { readonly current: Element | null },
  zoneFraction = 0.3
): number {
  const [proximity, setProximity] = useState(0)
  const isMobileRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    isMobileRef.current = mq.matches

    const onMediaChange = (e: MediaQueryListEvent) => {
      isMobileRef.current = e.matches
      if (!e.matches) setProximity(0)
    }

    const calc = () => {
      if (!isMobileRef.current || !ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const elCenter = rect.top + rect.height / 2
      const vpCenter = window.innerHeight / 2
      const zone = window.innerHeight * zoneFraction
      const distance = Math.abs(elCenter - vpCenter)
      setProximity(Math.max(0, 1 - distance / zone))
    }

    mq.addEventListener("change", onMediaChange)
    window.addEventListener("scroll", calc, { passive: true })
    calc()

    return () => {
      window.removeEventListener("scroll", calc)
      mq.removeEventListener("change", onMediaChange)
    }
  }, [ref, zoneFraction])

  return proximity
}

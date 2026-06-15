"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { GradientBorderOverlay } from "@/components/gradient-border-overlay"
import { useScrollProximity } from "@/hooks/use-scroll-proximity"

interface StatCounterProps {
  end: number
  suffix?: string
  prefix?: string
  label: string
  duration?: number
  className?: string
}

export function StatCounter({
  end,
  suffix = "",
  prefix = "",
  label,
  duration = 2000,
  className,
}: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Scroll proximity drives card scale + shadow on mobile
  const scrollProximity = useScrollProximity(ref)
  const isHighlighted = scrollProximity > 0

  // Count-up animation on intersection
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    if (prefersReduced) {
      setCount(end)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let startTime: number | null = null
          const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            const easedProgress = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(easedProgress * end))
            if (progress < 1) requestAnimationFrame(step)
            else setCount(end)
          }
          requestAnimationFrame(step)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )

    const el = ref.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration, hasAnimated])

  return (
    <div
      ref={ref}
      className={cn(
        "group relative rounded-xl bg-card p-6 shadow-sm transition-all duration-200 corner-squircle hover:scale-[1.02] hover:shadow-md",
        "flex flex-col items-center gap-1",
        className
      )}
      style={
        isHighlighted
          ? {
              transform: `scale(${1 + 0.02 * scrollProximity})`,
              boxShadow: `0 4px 6px -1px rgb(0 0 0 / ${scrollProximity * 0.1}), 0 2px 4px -2px rgb(0 0 0 / ${scrollProximity * 0.1})`,
            }
          : undefined
      }
    >
      {/* GradientBorderOverlay drives its own border scroll-proximity internally */}
      <GradientBorderOverlay />

      <span className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {prefix && <span className="text-gradient-brand">{prefix}</span>}
        {count}
        {suffix && <span className="text-gradient-brand">{suffix}</span>}
      </span>
      <span className="text-center text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

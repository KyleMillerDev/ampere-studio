"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimateOnScrollProps {
  children: React.ReactNode
  className?: string
  animation?: "fade-in-up" | "fade-in" | "fade-in-left" | "fade-in-right"
  delay?: 0 | 100 | 200 | 300 | 400 | 500 | 600 | 700
  threshold?: number
}

const animationClasses = {
  "fade-in-up": "animate-in fade-in slide-in-from-bottom-6",
  "fade-in": "animate-in fade-in",
  "fade-in-left": "animate-in fade-in slide-in-from-left-6",
  "fade-in-right": "animate-in fade-in slide-in-from-right-6",
}

const delayClasses: Record<number, string> = {
  0: "delay-0",
  100: "delay-100",
  200: "delay-200",
  300: "delay-300",
  400: "delay-400",
  500: "delay-500",
  600: "delay-600",
  700: "delay-700",
}

export function AnimateOnScroll({
  children,
  className,
  animation = "fade-in-up",
  delay = 0,
  threshold = 0.1,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    const el = ref.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return (
    <div
      ref={ref}
      className={cn(
        "min-h-0 transition-all duration-700 fill-mode-both",
        isVisible ? animationClasses[animation] : "opacity-0 translate-y-4",
        isVisible && delayClasses[delay],
        className
      )}
    >
      {children}
    </div>
  )
}

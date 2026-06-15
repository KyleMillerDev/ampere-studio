"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { motion } from "motion/react"
import {
  Home03Icon,
  Image01Icon,
  Mail01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card } from "./ui/card"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
}

interface ErrorPageProps {
  errorCode?: string
  title?: string
  /** Short explanation of what happened for visitors */
  description?: string
  navItems?: NavItem[]
  onRetry?: () => void
  retryLabel?: string
}

const defaultNavItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: (
      <HugeiconsIcon
        icon={Home03Icon}
        className="size-8 text-blue-500 md:h-12 md:w-12"
      />
    ),
    label: "Dashboard",
  },
  {
    href: "/products",
    icon: (
      <HugeiconsIcon
        icon={ShoppingCart01Icon}
        className="size-8 text-teal-500 md:h-12 md:w-12"
      />
    ),
    label: "Products",
  },
  {
    href: "/content",
    icon: (
      <HugeiconsIcon
        icon={Image01Icon}
        className="size-8 text-purple-500 md:h-12 md:w-12"
      />
    ),
    label: "Content",
  },
  {
    href: "/submissions",
    icon: (
      <HugeiconsIcon
        icon={Mail01Icon}
        className="size-8 text-emerald-500 md:h-12 md:w-12"
      />
    ),
    label: "Submissions",
  },
]

const ErrorPage = ({
  errorCode = "404",
  title = "Oops! Page Not Found",
  description,
  navItems,
  onRetry,
  retryLabel = "Try again",
}: ErrorPageProps) => {
  const items = navItems ?? defaultNavItems
  const codeParts = errorCode.padStart(3, "0").slice(-3).split("")

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background py-16">
      {/* Animated background shapes */}
      <div className="absolute inset-0 h-full w-full">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "absolute h-64 w-64 rounded-full",
              i === 1 || i === 4 ? "bg-secondary-500/12" : "bg-primary/5"
            )}
            initial={{
              scale: 0,
              x: Math.random() * 100 - 50,
              y: Math.random() * 100 - 50,
            }}
            animate={{
              scale: [1, 1.2, 1],
              x: [null, Math.random() * 200 - 100],
              y: [null, Math.random() * 200 - 100],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 space-y-8 px-4 text-center">
        <motion.h1
          className="text-9xl font-extrabold text-foreground"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {codeParts[0]}
          <span className="text-primary">{codeParts[1]}</span>
          {codeParts[2]}
        </motion.h1>
        <motion.h2
          className="text-2xl font-medium text-muted-foreground"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {title}
        </motion.h2>
        {description ? (
          <motion.p
            className="mx-auto max-w-lg text-base text-pretty text-muted-foreground"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.28 }}
          >
            {description}
          </motion.p>
        ) : null}
        {onRetry ? (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.32 }}
          >
            <Button type="button" size="lg" onClick={onRetry}>
              {retryLabel}
            </Button>
          </motion.div>
        ) : null}
        <motion.div
          className="flex items-center justify-center gap-4 pt-6"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* Navigation Cards */}
          <div className="grid grid-cols-2 gap-4 pt-8 sm:grid-cols-4">
            {items.map((item: NavItem, index: number) => (
              <Link href={item.href} key={index}>
                <Card className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 border-muted bg-muted/10 p-6 transition-colors hover:bg-muted/20">
                  {item.icon}
                  <span className="text-sm text-muted-foreground md:text-base">
                    {item.label}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div className="absolute bottom-10 left-10 size-20 rounded-full border-4 border-primary/20" />
      <div className="absolute top-10 right-10 size-16 rotate-45 border-4 border-primary/20" />
      <div className="absolute right-1/4 bottom-1/4 size-24 rounded-full border-4 border-dashed border-secondary-500/20" />
    </div>
  )
}
export { ErrorPage }

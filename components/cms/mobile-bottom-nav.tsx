"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  PackageIcon,
  News01Icon,
  InboxIcon,
  ShoppingCart01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons"

import { useSidebar } from "@/components/ui/sidebar"
import type { ClientFeatures } from "@/lib/cms/client-features"

interface MobileBottomNavProps {
  features: ClientFeatures
  ordersEnabled?: boolean
  squareOrdersEnabled?: boolean
  unreadSubmissionsCount?: number
}

type NavItem = {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  href: string
  label: string
  matchPrefix?: boolean
  badge?: number
}

const INDICATOR_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  mass: 0.9,
}

function isActiveItem(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) {
    if (item.href === "/products") {
      return (
        pathname === "/products" ||
        /^\/products(\/(?!categories).*)?$/.test(pathname)
      )
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  return pathname === item.href
}

export function MobileBottomNav({
  features,
  ordersEnabled = false,
  squareOrdersEnabled = false,
  unreadSubmissionsCount = 0,
}: MobileBottomNavProps) {
  const pathname = usePathname() ?? "/"
  const { toggleSidebar, openMobile, isMobile } = useSidebar()

  if (!isMobile) return null

  const isSquare = features.catalog === "square"

  const navItems: NavItem[] = []

  navItems.push({
    icon: Home01Icon,
    href: isSquare ? "/square/analytics" : "/dashboard",
    label: "Overview",
  })

  if (features.catalog) {
    navItems.push({
      icon: PackageIcon,
      href: "/products",
      label: "Products",
      matchPrefix: true,
    })
  }

  if (!isSquare && ordersEnabled) {
    navItems.push({
      icon: ShoppingCart01Icon,
      href: "/orders",
      label: "Orders",
      matchPrefix: true,
    })
  } else if (isSquare && squareOrdersEnabled) {
    navItems.push({
      icon: ShoppingCart01Icon,
      href: "/square/orders",
      label: "Orders",
      matchPrefix: true,
    })
  }

  if (features.blog) {
    navItems.push({
      icon: News01Icon,
      href: "/articles",
      label: "Articles",
      matchPrefix: true,
    })
  }

  if (features.submissions) {
    navItems.push({
      icon: InboxIcon,
      href: "/submissions",
      label: "Submissions",
      matchPrefix: true,
      badge: unreadSubmissionsCount > 0 ? unreadSubmissionsCount : undefined,
    })
  }

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 flex h-16 items-center justify-around border-t bg-background/90 px-3 backdrop-blur supports-backdrop-filter:bg-background/70">
      {/* Hamburger — styled identically to nav items, indicator active when sheet is open */}
      <button
        onClick={toggleSidebar}
        aria-label="Open menu"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl"
      >
        {openMobile && (
          <motion.div
            layoutId="mobile-nav-indicator"
            className="absolute inset-0 rounded-xl bg-primary/10"
            transition={INDICATOR_SPRING}
          />
        )}
        <span className="relative z-10 flex items-center justify-center">
          <HugeiconsIcon
            icon={Menu01Icon}
            className={openMobile ? "text-primary" : "text-muted-foreground"}
            strokeWidth={openMobile ? 2 : 1.5}
          />
        </span>
      </button>

      {/* Route nav items — indicator active on current route (when sheet is closed) */}
      {navItems.map((item) => {
        const active = !openMobile && isActiveItem(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl"
          >
            {active && (
              <motion.div
                layoutId="mobile-nav-indicator"
                className="absolute inset-0 rounded-xl bg-primary/10"
                transition={INDICATOR_SPRING}
              />
            )}
            <span className="relative z-10 flex items-center justify-center">
              <HugeiconsIcon
                icon={item.icon}
                className={active ? "text-primary" : "text-muted-foreground"}
                strokeWidth={active ? 2 : 1.5}
              />
            </span>
            {item.badge != null && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-medium text-primary-foreground">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

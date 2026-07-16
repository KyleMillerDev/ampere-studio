"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  PackageIcon,
  Folder01Icon,
  ChartBarLineIcon,
  DollarCircleIcon,
  InboxIcon,
  PencilEdit01Icon,
  SparklesIcon,
  News01Icon,
  TruckIcon,
  ShoppingCart01Icon,
  TicketIcon,
  Settings01Icon,
  CheckmarkSquare01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { DevInviteUserDialog } from "@/components/cms/dev-invite-user-dialog"
import { UserMenu } from "@/components/cms/user-menu"
import type { ClientFeatures } from "@/lib/cms/client-features"
import type { ClientOption } from "@/lib/cms/clients"

type NavEntry = {
  title: string
  href: string
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  matchPrefix?: boolean
  badgeCount?: number
}

function appendSharedFeatureNav(
  items: NavEntry[],
  features: ClientFeatures,
  unreadSubmissionsCount = 0
): NavEntry[] {
  const result = [...items]

  if (features.blog) {
    result.push({
      title: "Articles",
      href: "/articles",
      icon: News01Icon,
      matchPrefix: true,
    })
  }

  if (features.submissions) {
    result.push({
      title: "Submissions",
      href: "/submissions",
      icon: InboxIcon,
      matchPrefix: true,
      badgeCount:
        unreadSubmissionsCount > 0 ? unreadSubmissionsCount : undefined,
    })
  }

  if (features.rentals) {
    result.push({
      title: "Rentals",
      href: "/rentals",
      icon: TruckIcon,
      matchPrefix: true,
    })
  }

  return result
}

function buildWorkspaceNav(
  features: ClientFeatures,
  ordersEnabled: boolean,
  unreadSubmissionsCount = 0
): NavEntry[] {
  const items: NavEntry[] = [
    { title: "Overview", href: "/dashboard", icon: DashboardSquare01Icon },
  ]

  if (features.catalog) {
    items.push(
      {
        title: "Products",
        href: "/products",
        icon: PackageIcon,
        matchPrefix: true,
      },
      {
        title: "Categories",
        href: "/products/categories",
        icon: Folder01Icon,
      }
    )
  }

  if (ordersEnabled) {
    items.push({
      title: "Orders",
      href: "/orders",
      icon: ShoppingCart01Icon,
      matchPrefix: true,
    })
  }

  return appendSharedFeatureNav(items, features, unreadSubmissionsCount)
}

function buildInsightsNav(
  features: ClientFeatures,
  ordersEnabled: boolean
): NavEntry[] {
  if (!features.analytics) return []

  const items: NavEntry[] = [
    { title: "Analytics", href: "/analytics", icon: ChartBarLineIcon },
  ]

  if (ordersEnabled) {
    items.push({
      title: "Sales overview",
      href: "/sales-overview",
      icon: DollarCircleIcon,
    })
  }

  return items
}

function buildEditorNav(features: ClientFeatures): NavEntry[] {
  if (!features.siteEditor) return []

  return [
    {
      title: "Content editor",
      href: "/content",
      icon: PencilEdit01Icon,
      matchPrefix: true,
    },
  ]
}

function isActive(pathname: string, entry: NavEntry): boolean {
  if (entry.matchPrefix) {
    if (entry.href === "/products") {
      return (
        pathname === "/products" ||
        /^\/products(\/(?!categories).*)?$/.test(pathname)
      )
    }
    return pathname === entry.href || pathname.startsWith(`${entry.href}/`)
  }
  return pathname === entry.href
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavEntry[]
  pathname: string
}) {
  if (items.length === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(pathname, item)}>
                <Link href={item.href}>
                  <HugeiconsIcon icon={item.icon} className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.badgeCount ? (
                <SidebarMenuBadge className="bg-primary text-primary-foreground">
                  {item.badgeCount > 99 ? "99+" : item.badgeCount}
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

interface AppSidebarProps {
  clientName: string
  features: ClientFeatures
  ordersEnabled?: boolean
  squareEnabled?: boolean
  squareOrdersEnabled?: boolean
  unreadSubmissionsCount?: number
  activeClientId?: string
  devClients?: ClientOption[]
}

function buildSquareNav(
  squareEnabled: boolean,
  squareOrdersEnabled: boolean
): NavEntry[] {
  if (!squareEnabled) return []
  const items: NavEntry[] = []
  if (squareOrdersEnabled) {
    items.push({
      title: "Sales Overview",
      href: "/square/analytics",
      icon: DollarCircleIcon,
    })
    items.push({
      title: "Orders",
      href: "/square/orders",
      icon: ShoppingCart01Icon,
      matchPrefix: true,
    })
  }
  items.push(
    {
      title: "Products",
      href: "/products",
      icon: PackageIcon,
      matchPrefix: true,
    },
    { title: "Categories", href: "/products/categories", icon: Folder01Icon },
    {
      title: "Discounts",
      href: "/square/discounts",
      icon: TicketIcon,
      matchPrefix: true,
    },
    {
      title: "Option templates",
      href: "/square/options",
      icon: CheckmarkSquare01Icon,
      matchPrefix: true,
    }
  )
  items.push({
    title: "Settings",
    href: "/square/settings",
    icon: Settings01Icon,
  })
  return items
}

export function AppSidebar({
  clientName,
  features,
  ordersEnabled = false,
  squareEnabled = false,
  squareOrdersEnabled = false,
  unreadSubmissionsCount = 0,
  activeClientId = "",
  devClients = [],
}: AppSidebarProps) {
  const pathname = usePathname() ?? "/"

  // When catalog is Square, replace the default workspace nav with Square nav
  const isSquare = features.catalog === "square"
  const squareNav = buildSquareNav(squareEnabled, squareOrdersEnabled)
  const workspaceNav = isSquare
    ? appendSharedFeatureNav(squareNav, features, unreadSubmissionsCount)
    : buildWorkspaceNav(features, ordersEnabled, unreadSubmissionsCount)
  const insightsNav = isSquare ? [] : buildInsightsNav(features, ordersEnabled)
  const editorNav = buildEditorNav(features)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={SparklesIcon} className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">
              Ampere Studio
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {clientName}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Workspace" items={workspaceNav} pathname={pathname} />
        <NavGroup label="Insights" items={insightsNav} pathname={pathname} />
        <NavGroup label="Site editor" items={editorNav} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter className="gap-2">
        {process.env.NODE_ENV === "development" && devClients.length > 0 ? (
          <DevInviteUserDialog
            activeClientId={activeClientId}
            clients={devClients}
          />
        ) : null}
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

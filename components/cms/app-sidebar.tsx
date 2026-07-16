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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UserMenu } from "@/components/cms/user-menu"
import type { ClientFeatures } from "@/lib/cms/client-features"

type NavEntry = {
  title: string
  href: string
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  matchPrefix?: boolean
}

function buildWorkspaceNav(
  features: ClientFeatures,
  ordersEnabled: boolean
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

  if (features.blog) {
    items.push({
      title: "Articles",
      href: "/articles",
      icon: News01Icon,
      matchPrefix: true,
    })
  }

  if (features.submissions) {
    items.push({
      title: "Submissions",
      href: "/submissions",
      icon: InboxIcon,
      matchPrefix: true,
    })
  }

  if (features.rentals) {
    items.push({
      title: "Rentals",
      href: "/rentals",
      icon: TruckIcon,
      matchPrefix: true,
    })
  }

  return items
}

function buildInsightsNav(features: ClientFeatures): NavEntry[] {
  if (!features.analytics) return []

  return [
    { title: "Analytics", href: "/analytics", icon: ChartBarLineIcon },
    {
      title: "Sales overview",
      href: "/sales-overview",
      icon: DollarCircleIcon,
    },
  ]
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
}

export function AppSidebar({
  clientName,
  features,
  ordersEnabled = false,
}: AppSidebarProps) {
  const pathname = usePathname() ?? "/"
  const workspaceNav = buildWorkspaceNav(features, ordersEnabled)
  const insightsNav = buildInsightsNav(features)
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
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

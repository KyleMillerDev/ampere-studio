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

type NavEntry = {
  title: string
  href: string
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  matchPrefix?: boolean
}

const workspaceNav: NavEntry[] = [
  { title: "Overview", href: "/dashboard", icon: DashboardSquare01Icon },
  {
    title: "Products",
    href: "/products",
    icon: PackageIcon,
    matchPrefix: true,
  },
  { title: "Categories", href: "/products/categories", icon: Folder01Icon },
  { title: "Articles", href: "/articles", icon: News01Icon, matchPrefix: true },
  {
    title: "Submissions",
    href: "/submissions",
    icon: InboxIcon,
    matchPrefix: true,
  },
]

const insightsNav: NavEntry[] = [
  { title: "Analytics", href: "/analytics", icon: ChartBarLineIcon },
  { title: "Sales overview", href: "/sales-overview", icon: DollarCircleIcon },
]

const editorNav: NavEntry[] = [
  {
    title: "Content editor",
    href: "/content",
    icon: PencilEdit01Icon,
    matchPrefix: true,
  },
]

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
  clientId: string
}

export function AppSidebar({ clientId }: AppSidebarProps) {
  const pathname = usePathname() ?? "/"

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
              Client: {clientId}
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

"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DevClientSelector } from "@/components/cms/dev-client-selector"
import { ThemeToggle } from "@/components/theme-toggle"
import type { ClientOption } from "@/lib/cms/clients"

const LABELS: Record<string, string> = {
  dashboard: "Overview",
  products: "Products",
  categories: "Categories",
  orders: "Orders",
  analytics: "Analytics",
  "sales-overview": "Sales overview",
  submissions: "Submissions",
  account: "Account",
  security: "Security",
  new: "New",
  edit: "Edit",
}

function prettify(segment: string): string {
  if (LABELS[segment]) return LABELS[segment]
  if (segment.startsWith("prod_")) return "Edit product"
  if (segment.startsWith("cat_")) return "Edit category"
  if (segment.startsWith("pi_")) return "Order details"
  return segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

interface DashboardHeaderProps {
  activeClientId: string
  devClients?: ClientOption[]
}

export function DashboardHeader({
  activeClientId,
  devClients = [],
}: DashboardHeaderProps) {
  const pathname = usePathname() ?? "/"
  const segments = pathname.split("/").filter(Boolean)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
      <Breadcrumb>
        <BreadcrumbList>
          {segments.length === 0 ? (
            <BreadcrumbItem>
              <BreadcrumbPage>Overview</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            segments.map((segment, idx) => {
              const href = "/" + segments.slice(0, idx + 1).join("/")
              const isLast = idx === segments.length - 1
              return (
                <Fragment key={href}>
                  {idx > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{prettify(segment)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href}>{prettify(segment)}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        {process.env.NODE_ENV === "development" ? (
          <DevClientSelector
            activeClientId={activeClientId}
            clients={devClients}
          />
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  )
}

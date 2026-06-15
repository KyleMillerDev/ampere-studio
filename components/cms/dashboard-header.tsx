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
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DevClientSelector } from "@/components/cms/dev-client-selector"
import type { ClientOption } from "@/lib/cms/clients"

const LABELS: Record<string, string> = {
  dashboard: "Overview",
  products: "Products",
  categories: "Categories",
  analytics: "Analytics",
  "sales-overview": "Sales overview",
  submissions: "Submissions",
  account: "Account",
  security: "Security",
  new: "New",
}

function prettify(segment: string): string {
  if (LABELS[segment]) return LABELS[segment]
  if (segment.startsWith("prod_")) return "Edit product"
  if (segment.startsWith("cat_")) return "Edit category"
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
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-4" />
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
      {process.env.NODE_ENV === "development" ? (
        <DevClientSelector
          activeClientId={activeClientId}
          clients={devClients}
        />
      ) : null}
    </header>
  )
}

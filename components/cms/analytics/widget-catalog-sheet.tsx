"use client"

/**
 * Searchable, categorized widget catalog sheet.
 *
 * Opened from the edit toolbar. Lets users add available widgets to the
 * dashboard. Widgets that need uncaptured tracking data are listed but
 * shown as disabled with a plain explanation of what must be set up.
 */

import { useCallback, useMemo, useState } from "react"
import { PlusIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { AnalyticsWidgetId } from "@/lib/analytics/types"
import {
  CATALOG_CATEGORIES,
  WIDGET_CATALOG,
  type CatalogWidget,
} from "@/lib/analytics/widget-catalog"

import { WIDGET_TITLES } from "./analytics-help-data"
import { userFacingTrackingReason } from "./education-actions"

interface WidgetCatalogSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeWidgetIds: AnalyticsWidgetId[]
  onAdd: (id: AnalyticsWidgetId) => void
}

export function WidgetCatalogSheet({
  open,
  onOpenChange,
  activeWidgetIds,
  onAdd,
}: WidgetCatalogSheetProps) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return WIDGET_CATALOG
    return WIDGET_CATALOG.filter((w) => {
      const title = (WIDGET_TITLES[w.id] ?? w.title).toLowerCase()
      return (
        title.includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
      )
    })
  }, [search])

  const activeSet = useMemo(() => new Set(activeWidgetIds), [activeWidgetIds])

  const handleAdd = useCallback(
    (id: AnalyticsWidgetId) => {
      onAdd(id)
    },
    [onAdd]
  )

  // Group filtered widgets by category, preserving category order.
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogWidget[]>()
    for (const cat of CATALOG_CATEGORIES) {
      const widgets = filtered.filter((w) => w.category === cat.key)
      if (widgets.length > 0) {
        map.set(cat.label, widgets)
      }
    }
    return map
  }, [filtered])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Add widgets</SheetTitle>
          <SheetDescription>
            Choose widgets to add to your dashboard. Some require additional
            tracking to be configured first.
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="border-b px-5 py-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search widgets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        {/* Widget list */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 px-5 py-4">
            {grouped.size === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No widgets match &ldquo;{search}&rdquo;.
              </p>
            )}

            {Array.from(grouped.entries()).map(([categoryLabel, widgets]) => (
              <div key={categoryLabel}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {categoryLabel}
                </h3>
                <div className="space-y-1.5">
                  {widgets.map((widget) => (
                    <CatalogRow
                      key={widget.id}
                      widget={widget}
                      isActive={activeSet.has(widget.id)}
                      onAdd={handleAdd}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Catalog row ──────────────────────────────────────────────────────────────

interface CatalogRowProps {
  widget: CatalogWidget
  isActive: boolean
  onAdd: (id: AnalyticsWidgetId) => void
}

function CatalogRow({ widget, isActive, onAdd }: CatalogRowProps) {
  const isDisabled =
    isActive || widget.availability.status === "needs_tracking"
  const needsTracking = widget.availability.status === "needs_tracking"
  const title = WIDGET_TITLES[widget.id] ?? widget.title
  const trackingReason =
    needsTracking && widget.availability.status === "needs_tracking"
      ? userFacingTrackingReason(widget.availability.reason)
      : null

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        isDisabled
          ? "opacity-60"
          : "hover:bg-accent/50 cursor-pointer"
      )}
      onClick={() => {
        if (!isDisabled) onAdd(widget.id)
      }}
      role={isDisabled ? undefined : "button"}
      tabIndex={isDisabled ? undefined : 0}
      onKeyDown={(e) => {
        if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onAdd(widget.id)
        }
      }}
    >
      {/* Text */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium leading-none">{title}</span>
          {isActive && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              Added
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{widget.description}</p>
        {trackingReason && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
            {trackingReason}
          </p>
        )}
      </div>

      {/* Add button */}
      {!isActive && !needsTracking && (
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onAdd(widget.id)
          }}
          aria-label={`Add ${title}`}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

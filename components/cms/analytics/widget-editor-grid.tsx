"use client"

/**
 * Widget editor grid.
 *
 * Desktop: react-grid-layout 12-col draggable/resizable grid with per-card
 * edit controls (drag handle, width presets, red remove button).
 *
 * Mobile: single-column list with move-up / move-down / remove controls.
 * Freeform width is ignored on mobile; all widgets are full-width.
 */

import { useCallback, useEffect, useState } from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripHorizontalIcon,
  MinusIcon,
} from "lucide-react"
import {
  GridLayout,
  useContainerWidth,
  verticalCompactor,
  type LayoutItem,
} from "react-grid-layout"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  AnalyticsFilterDimension,
  AnalyticsGlobalFilters,
  AnalyticsGridItem,
  AnalyticsResponsiveLayouts,
  AnalyticsWidgetId,
  WidgetResultEntry,
} from "@/lib/analytics/types"
import { WidgetRenderer } from "./widget-renderer"

// ─── Width preset map ─────────────────────────────────────────────────────────

const WIDTH_PRESETS: { cols: number; label: string }[] = [
  { cols: 4, label: "1/3" },
  { cols: 6, label: "1/2" },
  { cols: 8, label: "2/3" },
  { cols: 12, label: "Full" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRGLLayout(items: AnalyticsGridItem[]): LayoutItem[] {
  return items.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW ?? 2,
    minH: item.minH ?? 2,
    maxW: item.maxW,
    maxH: item.maxH,
  }))
}

function fromRGLLayout(items: readonly LayoutItem[]): AnalyticsGridItem[] {
  return items.map((item) => ({
    i: item.i as AnalyticsWidgetId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
  }))
}

/** Rebuild a clean stacked single-column sm layout from an ordered widget list. */
function buildSmLayout(widgetIds: AnalyticsWidgetId[]): AnalyticsGridItem[] {
  return widgetIds.map((id, index) => ({
    i: id,
    x: 0,
    y: index * 3,
    w: 12,
    h: 3,
    minW: 2,
    minH: 2,
  }))
}

// ─── WidgetEditorGrid ─────────────────────────────────────────────────────────

interface WidgetEditorGridProps {
  widgetIds: AnalyticsWidgetId[]
  layouts: AnalyticsResponsiveLayouts
  results: Partial<Record<AnalyticsWidgetId, WidgetResultEntry>>
  loading: boolean
  filters: AnalyticsGlobalFilters
  onFilterAdd: (dimension: AnalyticsFilterDimension, value: string) => void
  onLayoutChange: (widgetIds: AnalyticsWidgetId[], layouts: AnalyticsResponsiveLayouts) => void
  onRemoveWidget: (id: AnalyticsWidgetId) => void
}

export function WidgetEditorGrid({
  widgetIds,
  layouts,
  results,
  loading,
  filters,
  onFilterAdd,
  onLayoutChange,
  onRemoveWidget,
}: WidgetEditorGridProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const handleDesktopLayoutChange = useCallback(
    (newRGLLayout: readonly LayoutItem[]) => {
      const lgItems = fromRGLLayout(newRGLLayout)
      // Preserve widgetIds order from the RGL layout (sorted by y then x).
      const sorted = [...lgItems].sort((a, b) =>
        a.y !== b.y ? a.y - b.y : a.x - b.x
      )
      const newWidgetIds = sorted.map((item) => item.i)
      const newLayouts: AnalyticsResponsiveLayouts = {
        lg: lgItems,
        md: lgItems, // mirror lg for medium breakpoint
        sm: buildSmLayout(newWidgetIds),
      }
      onLayoutChange(newWidgetIds, newLayouts)
    },
    [onLayoutChange]
  )

  const handleResizePreset = useCallback(
    (id: AnalyticsWidgetId, newW: number) => {
      const updatedLg = layouts.lg.map((item) =>
        item.i === id ? { ...item, w: Math.min(12, Math.max(2, newW)) } : item
      )
      const sorted = [...updatedLg].sort((a, b) =>
        a.y !== b.y ? a.y - b.y : a.x - b.x
      )
      const newWidgetIds = sorted.map((item) => item.i)
      onLayoutChange(newWidgetIds, {
        lg: updatedLg,
        md: updatedLg,
        sm: buildSmLayout(newWidgetIds),
      })
    },
    [layouts.lg, onLayoutChange]
  )

  const handleMoveUp = useCallback(
    (id: AnalyticsWidgetId) => {
      const idx = widgetIds.indexOf(id)
      if (idx <= 0) return
      const newIds = [...widgetIds]
      ;[newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]]
      onLayoutChange(newIds, {
        lg: layouts.lg,
        md: layouts.md,
        sm: buildSmLayout(newIds),
      })
    },
    [widgetIds, layouts, onLayoutChange]
  )

  const handleMoveDown = useCallback(
    (id: AnalyticsWidgetId) => {
      const idx = widgetIds.indexOf(id)
      if (idx < 0 || idx >= widgetIds.length - 1) return
      const newIds = [...widgetIds]
      ;[newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]]
      onLayoutChange(newIds, {
        lg: layouts.lg,
        md: layouts.md,
        sm: buildSmLayout(newIds),
      })
    },
    [widgetIds, layouts, onLayoutChange]
  )

  if (isMobile) {
    return (
      <MobileEditorList
        widgetIds={widgetIds}
        results={results}
        loading={loading}
        filters={filters}
        onFilterAdd={onFilterAdd}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onRemove={onRemoveWidget}
      />
    )
  }

  return (
    <DesktopEditorGrid
      lgLayout={layouts.lg}
      widgetIds={widgetIds}
      results={results}
      loading={loading}
      filters={filters}
      onFilterAdd={onFilterAdd}
      onDesktopLayoutChange={handleDesktopLayoutChange}
      onResizePreset={handleResizePreset}
      onRemove={onRemoveWidget}
    />
  )
}

// ─── Desktop grid ─────────────────────────────────────────────────────────────

interface DesktopEditorGridProps {
  lgLayout: AnalyticsGridItem[]
  widgetIds: AnalyticsWidgetId[]
  results: Partial<Record<AnalyticsWidgetId, WidgetResultEntry>>
  loading: boolean
  filters: AnalyticsGlobalFilters
  onFilterAdd: (dimension: AnalyticsFilterDimension, value: string) => void
  onDesktopLayoutChange: (layout: readonly LayoutItem[]) => void
  onResizePreset: (id: AnalyticsWidgetId, w: number) => void
  onRemove: (id: AnalyticsWidgetId) => void
}

function DesktopEditorGrid({
  lgLayout,
  widgetIds,
  results,
  loading,
  filters,
  onFilterAdd,
  onDesktopLayoutChange,
  onResizePreset,
  onRemove,
}: DesktopEditorGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth: 1200,
  })

  // Keep a stable reference to the RGL layout items. We derive it from
  // lgLayout, but RGL needs the full LayoutItem shape.
  const rglLayout = toRGLLayout(lgLayout)

  return (
    <div ref={containerRef} className="w-full">
      {mounted && (
        <GridLayout
          width={width}
          layout={rglLayout}
          gridConfig={{
            cols: 12,
            rowHeight: 80,
            margin: [16, 16],
            containerPadding: [0, 0],
          }}
          dragConfig={{
            enabled: true,
            handle: ".drag-handle",
            threshold: 5,
          }}
          resizeConfig={{
            enabled: true,
            handles: ["se"],
          }}
          compactor={verticalCompactor}
          onLayoutChange={onDesktopLayoutChange}
          className="overflow-visible!"
        >
          {widgetIds
            .map((id) => {
              const item = lgLayout.find((l) => l.i === id)
              if (!item) return null
              return (
                <div key={id} className="h-full">
                  <EditableCard
                    id={id}
                    item={item}
                    result={results[id]}
                    loading={loading}
                    filters={filters}
                    onFilterAdd={onFilterAdd}
                    onResizePreset={onResizePreset}
                    onRemove={onRemove}
                  />
                </div>
              )
            })
            .filter(Boolean)}
        </GridLayout>
      )}
    </div>
  )
}

// ─── Editable card (desktop) ──────────────────────────────────────────────────

interface EditableCardProps {
  id: AnalyticsWidgetId
  item: AnalyticsGridItem
  result: WidgetResultEntry | undefined
  loading: boolean
  filters: AnalyticsGlobalFilters
  onFilterAdd: (dimension: AnalyticsFilterDimension, value: string) => void
  onResizePreset: (id: AnalyticsWidgetId, w: number) => void
  onRemove: (id: AnalyticsWidgetId) => void
}

function EditableCard({
  id,
  item,
  result,
  loading,
  filters,
  onFilterAdd,
  onResizePreset,
  onRemove,
}: EditableCardProps) {
  return (
    <div className="group relative h-full select-none">
      {/* Dashed border overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-dashed border-primary/30" />

      {/* Drag handle */}
      <div className="drag-handle absolute inset-x-0 top-0 z-20 flex h-7 cursor-grab items-center justify-center rounded-t-lg bg-muted/70 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
        <GripHorizontalIcon className="size-4 text-muted-foreground" />
      </div>

      {/* Remove button */}
      <button
        type="button"
        className="nodrag absolute right-2 top-2 z-30 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-destructive/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <MinusIcon className="size-3" />
      </button>

      {/* Width presets */}
      <div className="nodrag absolute bottom-2 right-2 z-30 flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-1 opacity-0 shadow-sm ring-1 ring-border transition-opacity group-hover:opacity-100">
        {WIDTH_PRESETS.map(({ cols, label }) => (
          <button
            key={cols}
            type="button"
            className={cn(
              "h-5 rounded px-1.5 text-[10px] font-medium transition-colors",
              item.w === cols
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            onClick={() => onResizePreset(id, cols)}
            title={`Set width to ${label}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Widget content */}
      <div className="h-full overflow-hidden rounded-lg pt-7">
        <WidgetRenderer
          id={id}
          result={result}
          loading={loading}
          filters={filters}
          onFilterAdd={onFilterAdd}
          className="h-full"
        />
      </div>
    </div>
  )
}

// ─── Mobile list editor ───────────────────────────────────────────────────────

interface MobileEditorListProps {
  widgetIds: AnalyticsWidgetId[]
  results: Partial<Record<AnalyticsWidgetId, WidgetResultEntry>>
  loading: boolean
  filters: AnalyticsGlobalFilters
  onFilterAdd: (dimension: AnalyticsFilterDimension, value: string) => void
  onMoveUp: (id: AnalyticsWidgetId) => void
  onMoveDown: (id: AnalyticsWidgetId) => void
  onRemove: (id: AnalyticsWidgetId) => void
}

function MobileEditorList({
  widgetIds,
  results,
  loading,
  filters,
  onFilterAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
}: MobileEditorListProps) {
  return (
    <div className="flex flex-col gap-3">
      {widgetIds.map((id, index) => (
        <div key={id} className="group relative">
          {/* Dashed border */}
          <div className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-dashed border-primary/30" />

          {/* Mobile controls bar */}
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 bg-background/90 shadow-sm ring-1 ring-border"
              disabled={index === 0}
              onClick={() => onMoveUp(id)}
              aria-label="Move widget up"
            >
              <ChevronUpIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 bg-background/90 shadow-sm ring-1 ring-border"
              disabled={index === widgetIds.length - 1}
              onClick={() => onMoveDown(id)}
              aria-label="Move widget down"
            >
              <ChevronDownIcon className="size-4" />
            </Button>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md bg-destructive text-white shadow-sm transition-colors hover:bg-destructive/80"
              onClick={() => onRemove(id)}
              aria-label="Remove widget"
            >
              <MinusIcon className="size-3.5" />
            </button>
          </div>

          <WidgetRenderer
            id={id}
            result={results[id]}
            loading={loading}
            filters={filters}
            onFilterAdd={onFilterAdd}
            className="pt-2"
          />
        </div>
      ))}
    </div>
  )
}

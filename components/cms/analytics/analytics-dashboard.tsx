"use client"

/**
 * Main analytics dashboard client component.
 *
 * Manages filter state (synced to URL), fetches dashboard data,
 * and drives widget rendering from the persisted layout document.
 *
 * Edit mode flow:
 *  1. User clicks "Edit layout" → copy layout doc into editDraft, enter edit mode.
 *  2. Drag / resize / add / remove widgets → update editDraft.
 *  3. "Done" → PUT draft to API. On failure retain draft and show error.
 *  4. "Cancel" → discard draft.
 *  5. "Reset to default" → confirmation → DELETE layout API.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckIcon, PencilIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { v4 as uuid } from "uuid"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/cms/page-heading"
import type {
  AnalyticsFilterClause,
  AnalyticsFilterDimension,
  AnalyticsGlobalFilters,
  AnalyticsGridItem,
  AnalyticsLayoutDocument,
  AnalyticsResponsiveLayouts,
  AnalyticsWidgetId,
  WidgetResultEntry,
} from "@/lib/analytics/types"
import { DEFAULT_WIDGET_IDS, ANALYTICS_LAYOUT_VERSION } from "@/lib/analytics/types"
import { CATALOG_BY_ID } from "@/lib/analytics/widget-catalog"

import {
  addClause,
  clearClauses,
  filtersFromParams,
  filtersToParams,
  removeClause,
} from "./analytics-filter-utils"
import { FilterBadgeRail } from "./filter-badge"
import { FilterRail } from "./filter-rail"
import { LivePulseRail } from "./live-pulse-rail"
import { useAnalyticsDashboard } from "./use-analytics"
import { useLayout } from "./use-layout"
import { WidgetCatalogSheet } from "./widget-catalog-sheet"
import { WidgetEditorGrid } from "./widget-editor-grid"
import { WidgetRenderer } from "./widget-renderer"
import {
  AnalyticsComingSoonCard,
  AnalyticsConnectionErrorCard,
  AnalyticsLoadingState,
} from "./widget-states"

// ─── Filter state hook (URL-synchronized) ────────────────────────────────────

function useFilterState(): [
  AnalyticsGlobalFilters,
  (next: AnalyticsGlobalFilters) => void,
] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const paramsKey = searchParams.toString()
  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(paramsKey)),
    [paramsKey]
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setFilters = useCallback(
    (next: AnalyticsGlobalFilters) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = filtersToParams(next)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }, 100)
    },
    [router, pathname]
  )

  return [filters, setFilters]
}

// ─── Layout helpers ────────────────────────────────────────────────────────────

/** Sort grid items by y, then x. */
function sortByPosition(items: AnalyticsGridItem[]): AnalyticsGridItem[] {
  return [...items].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))
}

/** Build a stacked single-column sm layout. */
function buildSmLayout(ids: AnalyticsWidgetId[]): AnalyticsGridItem[] {
  return ids.map((id, i) => ({
    i: id,
    x: 0,
    y: i * 3,
    w: 12,
    h: 3,
    minW: 2,
    minH: 2,
  }))
}

/** Return widget IDs ordered by their lg grid position (y, x). */
function orderedWidgetIds(
  widgetIds: AnalyticsWidgetId[],
  lgLayout: AnalyticsGridItem[]
): AnalyticsWidgetId[] {
  const sorted = sortByPosition(lgLayout.filter((item) => widgetIds.includes(item.i)))
  return sorted.map((item) => item.i)
}

// ─── Default draft ─────────────────────────────────────────────────────────────

const DEFAULT_LG_LAYOUT: AnalyticsGridItem[] = [
  { i: "visitors", x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "pageviews", x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "bounce_rate", x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  { i: "visitors_over_time", x: 0, y: 2, w: 12, h: 4, minW: 4, minH: 2 },
  { i: "top_pages", x: 0, y: 6, w: 6, h: 4, minW: 2, minH: 2 },
  { i: "traffic_sources", x: 6, y: 6, w: 6, h: 4, minW: 2, minH: 2 },
]

// ─── Edit draft type ───────────────────────────────────────────────────────────

interface EditDraft {
  widgetIds: AnalyticsWidgetId[]
  layouts: AnalyticsResponsiveLayouts
}

function docToDraft(doc: AnalyticsLayoutDocument): EditDraft {
  return { widgetIds: doc.widgetIds, layouts: doc.layouts }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function AnalyticsDashboard({
  activeClientId,
}: {
  activeClientId: string
}) {
  const [filters, setFilters] = useFilterState()

  // Layout document (loaded from API). Keyed by active CMS client.
  const { state: layoutState, isSaving, saveLayout, resetLayout } =
    useLayout(activeClientId)

  // Edit mode state.
  const [isEditMode, setIsEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)

  // The currently-active layout (draft when editing, doc when viewing).
  const activeLayout = isEditMode && editDraft
    ? editDraft
    : layoutState.status === "ready"
      ? docToDraft(layoutState.layout)
      : null

  // Widget IDs for data fetching: use the layout doc, or fall back to defaults.
  const widgetIdsForFetch = useMemo(
    () =>
      activeLayout
        ? orderedWidgetIds(activeLayout.widgetIds, activeLayout.layouts.lg)
        : [...DEFAULT_WIDGET_IDS],
    [activeLayout]
  )

  const { state, isRefetching, refetch } = useAnalyticsDashboard(
    filters,
    widgetIdsForFetch,
    activeClientId
  )

  // ── Filter event handlers ──
  const handleFilterAdd = useCallback(
    (dimension: AnalyticsFilterDimension, value: string) => {
      const exists = filters.clauses.some(
        (c) => c.dimension === dimension && c.values.includes(value)
      )
      if (exists) return
      const clause: AnalyticsFilterClause = {
        id: uuid(),
        dimension,
        operator: "is",
        values: [value],
      }
      setFilters(addClause(filters, clause))
    },
    [filters, setFilters]
  )

  const handleClauseRemove = useCallback(
    (clauseId: string) => {
      setFilters(removeClause(filters, clauseId))
    },
    [filters, setFilters]
  )

  const handleClearAll = useCallback(() => {
    setFilters(clearClauses(filters))
  }, [filters, setFilters])

  // ── Edit mode actions ──
  const handleEnterEdit = useCallback(() => {
    const doc =
      layoutState.status === "ready" ? layoutState.layout : null
    const draft: EditDraft = doc
      ? docToDraft(doc)
      : {
          widgetIds: [...DEFAULT_WIDGET_IDS],
          layouts: {
            lg: DEFAULT_LG_LAYOUT,
            md: DEFAULT_LG_LAYOUT,
            sm: buildSmLayout([...DEFAULT_WIDGET_IDS]),
          },
        }
    setEditDraft(draft)
    setSaveError(null)
    setIsEditMode(true)
  }, [layoutState])

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false)
    setEditDraft(null)
    setSaveError(null)
  }, [])

  const handleDoneEdit = useCallback(async () => {
    if (!editDraft) return
    setSaveError(null)
    const result = await saveLayout({
      version: ANALYTICS_LAYOUT_VERSION,
      widgetIds: editDraft.widgetIds,
      layouts: editDraft.layouts,
    })
    if (result.ok) {
      setIsEditMode(false)
      setEditDraft(null)
    } else {
      setSaveError(result.message ?? "Could not save layout. Your changes are still here.")
    }
  }, [editDraft, saveLayout])

  const handleReset = useCallback(async () => {
    setSaveError(null)
    const result = await resetLayout()
    if (result.ok) {
      setIsEditMode(false)
      setEditDraft(null)
    } else {
      setSaveError(result.message ?? "Could not reset layout.")
    }
  }, [resetLayout])

  // ── Draft mutation helpers ──
  const handleDraftChange = useCallback(
    (widgetIds: AnalyticsWidgetId[], layouts: AnalyticsResponsiveLayouts) => {
      setEditDraft({ widgetIds, layouts })
    },
    []
  )

  const handleAddWidget = useCallback(
    (id: AnalyticsWidgetId) => {
      if (!editDraft) return
      if (editDraft.widgetIds.includes(id)) return
      const catalogEntry = CATALOG_BY_ID[id]
      const defaultSize = catalogEntry?.defaultSize ?? { w: 6, h: 4 }
      const maxY = editDraft.layouts.lg.reduce(
        (acc, item) => Math.max(acc, item.y + item.h),
        0
      )
      const newItem: AnalyticsGridItem = {
        i: id,
        x: 0,
        y: maxY,
        w: defaultSize.w,
        h: defaultSize.h,
        minW: 2,
        minH: 2,
      }
      const newWidgetIds = [...editDraft.widgetIds, id]
      const newLg = [...editDraft.layouts.lg, newItem]
      setEditDraft({
        widgetIds: newWidgetIds,
        layouts: {
          lg: newLg,
          md: newLg,
          sm: buildSmLayout(newWidgetIds),
        },
      })
    },
    [editDraft]
  )

  const handleRemoveWidget = useCallback(
    (id: AnalyticsWidgetId) => {
      if (!editDraft) return
      const newWidgetIds = editDraft.widgetIds.filter((w) => w !== id)
      if (newWidgetIds.length === 0) return // Always keep at least one widget.
      const newLg = editDraft.layouts.lg.filter((item) => item.i !== id)
      setEditDraft({
        widgetIds: newWidgetIds,
        layouts: {
          lg: newLg,
          md: newLg,
          sm: buildSmLayout(newWidgetIds),
        },
      })
    },
    [editDraft]
  )

  // ── State gates ──
  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="space-y-6">
        <DashboardHeader
          isEditMode={isEditMode}
          isSaving={isSaving}
          layoutReady={false}
          onEnterEdit={handleEnterEdit}
          onCancelEdit={handleCancelEdit}
          onDoneEdit={handleDoneEdit}
          onReset={handleReset}
          onOpenCatalog={() => setCatalogOpen(true)}
        />
        <AnalyticsLoadingState />
      </div>
    )
  }

  if (state.status === "not_configured") {
    return (
      <div className="space-y-6">
        <DashboardHeader
          isEditMode={false}
          isSaving={false}
          layoutReady={false}
          onEnterEdit={handleEnterEdit}
          onCancelEdit={handleCancelEdit}
          onDoneEdit={handleDoneEdit}
          onReset={handleReset}
          onOpenCatalog={() => setCatalogOpen(true)}
        />
        <AnalyticsComingSoonCard />
      </div>
    )
  }

  if (state.status === "connection_error") {
    return (
      <div className="space-y-6">
        <DashboardHeader
          isEditMode={false}
          isSaving={false}
          layoutReady={false}
          onEnterEdit={handleEnterEdit}
          onCancelEdit={handleCancelEdit}
          onDoneEdit={handleDoneEdit}
          onReset={handleReset}
          onOpenCatalog={() => setCatalogOpen(true)}
        />
        <AnalyticsConnectionErrorCard message={state.message} />
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <DashboardHeader
          isEditMode={isEditMode}
          isSaving={isSaving}
          layoutReady={layoutState.status === "ready"}
          filters={filters}
          onFiltersChange={setFilters}
          loading={false}
          onRefresh={refetch}
          onEnterEdit={handleEnterEdit}
          onCancelEdit={handleCancelEdit}
          onDoneEdit={handleDoneEdit}
          onReset={handleReset}
          onOpenCatalog={() => setCatalogOpen(true)}
        />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      </div>
    )
  }

  // ── State: ready ──
  const results = state.status === "ready" ? state.data.results : {}

  const displayWidgetIds = activeLayout
    ? orderedWidgetIds(activeLayout.widgetIds, activeLayout.layouts.lg)
    : [...DEFAULT_WIDGET_IDS]

  return (
    <div className="space-y-6">
      <DashboardHeader
        isEditMode={isEditMode}
        isSaving={isSaving}
        layoutReady={layoutState.status === "ready"}
        filters={filters}
        onFiltersChange={setFilters}
        loading={isRefetching}
        onRefresh={refetch}
        onEnterEdit={handleEnterEdit}
        onCancelEdit={handleCancelEdit}
        onDoneEdit={handleDoneEdit}
        onReset={handleReset}
        onOpenCatalog={() => setCatalogOpen(true)}
      />

      {/* Today's Pulse live rail */}
      {!isEditMode && <LivePulseRail activeClientId={activeClientId} />}

      {/* Active filter badges */}
      {filters.clauses.length > 0 && (
        <FilterBadgeRail
          clauses={filters.clauses}
          onRemove={handleClauseRemove}
          onClearAll={handleClearAll}
        />
      )}

      {/* Save error */}
      {saveError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* Widget grid */}
      {isEditMode && editDraft ? (
        <WidgetEditorGrid
          widgetIds={editDraft.widgetIds}
          layouts={editDraft.layouts}
          results={results}
          loading={isRefetching}
          filters={filters}
          onFilterAdd={handleFilterAdd}
          onLayoutChange={handleDraftChange}
          onRemoveWidget={handleRemoveWidget}
        />
      ) : (
        <WidgetViewGrid
          widgetIds={displayWidgetIds}
          lgLayout={activeLayout?.layouts.lg ?? DEFAULT_LG_LAYOUT}
          results={results}
          loading={isRefetching}
          filters={filters}
          onFilterAdd={handleFilterAdd}
        />
      )}

      {/* Fetched-at timestamp */}
      {state.status === "ready" && !isEditMode && (
        <p className="text-center text-xs text-muted-foreground/50">
          Last updated{" "}
          {new Date(state.fetchedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}

      {/* Widget catalog sheet */}
      <WidgetCatalogSheet
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        activeWidgetIds={editDraft?.widgetIds ?? []}
        onAdd={handleAddWidget}
      />
    </div>
  )
}

// ─── View-mode widget grid ────────────────────────────────────────────────────

interface WidgetViewGridProps {
  widgetIds: AnalyticsWidgetId[]
  lgLayout: AnalyticsGridItem[]
  results: Partial<Record<AnalyticsWidgetId, WidgetResultEntry>>
  loading: boolean
  filters: AnalyticsGlobalFilters
  onFilterAdd: (dimension: AnalyticsFilterDimension, value: string) => void
}

function WidgetViewGrid({
  widgetIds,
  lgLayout,
  results,
  loading,
  filters,
  onFilterAdd,
}: WidgetViewGridProps) {
  // Build a map from widget ID to its lg layout item for width lookup.
  const lgMap = useMemo(
    () =>
      new Map(lgLayout.map((item) => [item.i, item])),
    [lgLayout]
  )

  // Mobile: render in widgetIds order, each full width.
  // Desktop: render sorted by y,x with col-span from lgLayout.
  return (
    <>
      {/* Desktop: 12-col CSS grid */}
      <div className="hidden gap-4 lg:grid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
        {widgetIds.map((id) => {
          const item = lgMap.get(id)
          const colSpan = item?.w ?? 4
          return (
            <div
              key={id}
              style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
            >
              <WidgetRenderer
                id={id}
                result={results[id]}
                loading={loading}
                filters={filters}
                onFilterAdd={onFilterAdd}
              />
            </div>
          )
        })}
      </div>

      {/* Mobile: stacked single column */}
      <div className="flex flex-col gap-4 lg:hidden">
        {widgetIds.map((id) => (
          <WidgetRenderer
            key={id}
            id={id}
            result={results[id]}
            loading={loading}
            filters={filters}
            onFilterAdd={onFilterAdd}
          />
        ))}
      </div>
    </>
  )
}

// ─── Dashboard header ─────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  isEditMode: boolean
  isSaving: boolean
  layoutReady: boolean
  filters?: AnalyticsGlobalFilters
  onFiltersChange?: (next: AnalyticsGlobalFilters) => void
  loading?: boolean
  onRefresh?: () => void
  onEnterEdit: () => void
  onCancelEdit: () => void
  onDoneEdit: () => void
  onReset: () => void
  onOpenCatalog: () => void
}

function DashboardHeader({
  isEditMode,
  isSaving,
  layoutReady,
  filters,
  onFiltersChange,
  loading,
  onRefresh,
  onEnterEdit,
  onCancelEdit,
  onDoneEdit,
  onReset,
  onOpenCatalog,
}: DashboardHeaderProps) {
  return (
    <div className="space-y-4">
      <PageHeading
        title="Analytics"
        description="Traffic, conversions, and engagement across your site."
        actions={
          isEditMode ? (
            <EditModeActions
              isSaving={isSaving}
              onCancel={onCancelEdit}
              onDone={onDoneEdit}
              onReset={onReset}
              onOpenCatalog={onOpenCatalog}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={onEnterEdit}
              disabled={!layoutReady}
              title={layoutReady ? "Edit dashboard layout" : "Loading layout..."}
            >
              <PencilIcon className="size-3" />
              Edit layout
            </Button>
          )
        }
      />

      {filters && onFiltersChange && onRefresh !== undefined && (
        <FilterRail
          filters={filters}
          loading={loading ?? false}
          onFiltersChange={onFiltersChange}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}

// ─── Edit mode action bar ─────────────────────────────────────────────────────

interface EditModeActionsProps {
  isSaving: boolean
  onCancel: () => void
  onDone: () => void
  onReset: () => void
  onOpenCatalog: () => void
}

function EditModeActions({
  isSaving,
  onCancel,
  onDone,
  onReset,
  onOpenCatalog,
}: EditModeActionsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Add widgets */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onOpenCatalog}
        disabled={isSaving}
      >
        <PlusIcon className="size-3" />
        Add widgets
      </Button>

      {/* Reset to default */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            disabled={isSaving}
            title="Reset to default layout"
          >
            <RotateCcwIcon className="size-3" />
            Reset
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to default layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all customizations and restore the six default
              widgets. Your data and filters are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>
              Reset layout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground"
        onClick={onCancel}
        disabled={isSaving}
      >
        <XIcon className="size-3" />
        Cancel
      </Button>

      {/* Done */}
      <Button
        variant="default"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onDone}
        disabled={isSaving}
      >
        <CheckIcon className="size-3" />
        {isSaving ? "Saving..." : "Done"}
      </Button>
    </div>
  )
}

/**
 * Education action helpers for metric help and Analytics 101.
 * Pure validation and collection (no React) so integrity tests can import safely.
 */
import {
  ALL_WIDGET_IDS,
  isAnalyticsHelpAction,
  type AnalyticsFilterDimension,
  type AnalyticsHelpAction,
  type AnalyticsWidgetId,
} from "@/lib/analytics/types"
import { userFacingAnalyticsMessage } from "@/lib/analytics/user-facing"

import { METRIC_HELP } from "./analytics-help-data"

/** Routes help actions may navigate to (app-relative). */
export const ALLOWED_EDUCATION_ROUTES = ["/content"] as const

export type AllowedEducationRoute = (typeof ALLOWED_EDUCATION_ROUTES)[number]

export const EDUCATION_ACTION_KINDS = [
  "focus_widget",
  "open_filter",
  "apply_filter",
  "open_glossary",
  "navigate",
] as const satisfies readonly AnalyticsHelpAction["kind"][]

export type EducationActionKind = (typeof EDUCATION_ACTION_KINDS)[number]

const WIDGET_ID_SET = new Set<string>(ALL_WIDGET_IDS)

const FILTER_DIMENSIONS = new Set<AnalyticsFilterDimension>([
  "page",
  "entry_page",
  "exit_page",
  "viewed_page",
  "source",
  "referrer",
  "channel",
  "country",
  "region",
  "city",
  "device",
  "browser",
  "os",
  "screen_size",
  "language",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "goal",
  "event",
])

export function isAllowedEducationRoute(
  href: string
): href is AllowedEducationRoute {
  return (ALLOWED_EDUCATION_ROUTES as readonly string[]).includes(href)
}

export function isKnownEducationWidgetId(
  id: string
): id is AnalyticsWidgetId {
  return WIDGET_ID_SET.has(id)
}

export function widgetAnchorId(widgetId: AnalyticsWidgetId): string {
  return `analytics-widget-${widgetId}`
}

/** Anchor for Today's Pulse rail sections (avoids clashing with grid cards). */
export function liveWidgetAnchorId(widgetId: AnalyticsWidgetId): string {
  return `analytics-live-${widgetId}`
}

export function findWidgetAnchorElement(
  widgetId: AnalyticsWidgetId
): HTMLElement | null {
  if (typeof document === "undefined") return null
  const grid = document.getElementById(widgetAnchorId(widgetId))
  if (grid instanceof HTMLElement) return grid
  const live = document.getElementById(liveWidgetAnchorId(widgetId))
  return live instanceof HTMLElement ? live : null
}

/** Strip provider names from catalog availability reasons before showing users. */
export function userFacingTrackingReason(reason: string): string {
  return userFacingAnalyticsMessage(reason)
}

export interface EducationActionIssue {
  source: string
  message: string
}

export interface EducationActionValidationContext {
  glossaryTermIds: ReadonlySet<string>
}

export function validateEducationAction(
  action: AnalyticsHelpAction,
  source: string,
  ctx: EducationActionValidationContext
): EducationActionIssue[] {
  const issues: EducationActionIssue[] = []

  if (!(EDUCATION_ACTION_KINDS as readonly string[]).includes(action.kind)) {
    issues.push({
      source,
      message: `Unhandled action kind "${(action as { kind: string }).kind}"`,
    })
    return issues
  }

  if (!action.label?.trim()) {
    issues.push({ source, message: "Action is missing a label" })
  }

  switch (action.kind) {
    case "focus_widget":
      if (!isKnownEducationWidgetId(action.widgetId)) {
        issues.push({
          source,
          message: `Unknown widget id "${action.widgetId}"`,
        })
      }
      break
    case "open_filter":
      if (!FILTER_DIMENSIONS.has(action.dimension)) {
        issues.push({
          source,
          message: `Unknown filter dimension "${action.dimension}"`,
        })
      }
      break
    case "apply_filter":
      if (!FILTER_DIMENSIONS.has(action.clause.dimension)) {
        issues.push({
          source,
          message: `Unknown filter dimension "${action.clause.dimension}"`,
        })
      }
      if (!action.clause.values?.length) {
        issues.push({
          source,
          message: "apply_filter clause must include at least one value",
        })
      }
      break
    case "open_glossary":
      if (!ctx.glossaryTermIds.has(action.termId)) {
        issues.push({
          source,
          message: `Unknown glossary term id "${action.termId}"`,
        })
      }
      break
    case "navigate":
      if (!isAllowedEducationRoute(action.href)) {
        issues.push({
          source,
          message: `Navigate href "${action.href}" is not in the allowlist`,
        })
      }
      break
  }

  return issues
}

export interface CollectedEducationAction {
  source: string
  /** Null when a legacy plain-string next step was found. */
  action: AnalyticsHelpAction | null
  stringStep?: string
}

/** Collect typed next-step actions from METRIC_HELP. */
export function collectMetricHelpActions(): CollectedEducationAction[] {
  const out: CollectedEducationAction[] = []
  for (const [key, help] of Object.entries(METRIC_HELP)) {
    help.nextSteps.forEach((step, index) => {
      const source = `METRIC_HELP.${key}.nextSteps[${index}]`
      if (!isAnalyticsHelpAction(step)) {
        out.push({ source, action: null, stringStep: String(step) })
        return
      }
      out.push({ source, action: step })
    })
  }
  return out
}

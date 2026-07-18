/**
 * Per-user analytics dashboard layout persistence in Ampere-Studio-Content.
 * Key: client_id + id = analayout_<cognitoSub>
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb"

import {
  ANALYTICS_LAYOUT_SK_PREFIX,
  ANALYTICS_LAYOUT_VERSION,
  DEFAULT_WIDGET_IDS,
  isAnalyticsWidgetId,
  type AnalyticsGridItem,
  type AnalyticsLayoutDocument,
  type AnalyticsResponsiveLayouts,
  type AnalyticsWidgetId,
  type WidgetDisplayOptions,
} from "@/lib/analytics/types"
import { analyticsLayoutDocumentSchema } from "@/lib/analytics/schemas"
import { getDynamo } from "@/lib/aws/dynamo"
import { CONTENT_TABLE } from "@/lib/cms/constants"

export function analyticsLayoutId(cognitoSub: string): string {
  return `${ANALYTICS_LAYOUT_SK_PREFIX}${cognitoSub}`
}

function defaultGridItem(
  id: AnalyticsWidgetId,
  x: number,
  y: number,
  w: number,
  h: number
): AnalyticsGridItem {
  return { i: id, x, y, w, h, minW: 2, minH: 2 }
}

/** Six-widget Plausible-style default used when no saved layout exists. */
export function buildDefaultAnalyticsLayout(
  clientId: string,
  cognitoSub: string
): AnalyticsLayoutDocument {
  const lg: AnalyticsGridItem[] = [
    defaultGridItem("visitors", 0, 0, 4, 2),
    defaultGridItem("pageviews", 4, 0, 4, 2),
    defaultGridItem("bounce_rate", 8, 0, 4, 2),
    defaultGridItem("visitors_over_time", 0, 2, 12, 4),
    defaultGridItem("top_pages", 0, 6, 6, 4),
    defaultGridItem("traffic_sources", 6, 6, 6, 4),
  ]

  const md: AnalyticsGridItem[] = [
    defaultGridItem("visitors", 0, 0, 4, 2),
    defaultGridItem("pageviews", 4, 0, 4, 2),
    defaultGridItem("bounce_rate", 8, 0, 4, 2),
    defaultGridItem("visitors_over_time", 0, 2, 12, 4),
    defaultGridItem("top_pages", 0, 6, 6, 4),
    defaultGridItem("traffic_sources", 6, 6, 6, 4),
  ]

  const sm: AnalyticsGridItem[] = DEFAULT_WIDGET_IDS.map((id, index) =>
    defaultGridItem(id, 0, index * 3, 12, 3)
  )

  return {
    version: ANALYTICS_LAYOUT_VERSION,
    clientId,
    cognitoSub,
    widgetIds: [...DEFAULT_WIDGET_IDS],
    layouts: { lg, md, sm },
    updatedAt: new Date().toISOString(),
  }
}

function sanitizeGridItems(items: unknown[]): AnalyticsGridItem[] {
  const out: AnalyticsGridItem[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Record<string, unknown>
    const id = typeof item.i === "string" ? item.i : ""
    if (!isAnalyticsWidgetId(id)) continue
    out.push({
      i: id,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      w: Math.min(12, Math.max(1, Number(item.w) || 1)),
      h: Math.min(24, Math.max(1, Number(item.h) || 1)),
      ...(typeof item.minW === "number" ? { minW: item.minW } : {}),
      ...(typeof item.minH === "number" ? { minH: item.minH } : {}),
      ...(typeof item.maxW === "number" ? { maxW: item.maxW } : {}),
      ...(typeof item.maxH === "number" ? { maxH: item.maxH } : {}),
      ...(typeof item.static === "boolean" ? { static: item.static } : {}),
    })
  }
  return out
}

function sanitizeLayouts(raw: unknown): AnalyticsResponsiveLayouts {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  return {
    lg: sanitizeGridItems(Array.isArray(obj.lg) ? obj.lg : []),
    md: sanitizeGridItems(Array.isArray(obj.md) ? obj.md : []),
    sm: sanitizeGridItems(Array.isArray(obj.sm) ? obj.sm : []),
  }
}

function sanitizeWidgetIds(raw: unknown): AnalyticsWidgetId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_WIDGET_IDS]
  const ids = raw.filter(
    (id): id is AnalyticsWidgetId =>
      typeof id === "string" && isAnalyticsWidgetId(id)
  )
  return ids.length > 0 ? ids.slice(0, 48) : [...DEFAULT_WIDGET_IDS]
}

function sanitizeWidgetOptions(
  raw: unknown
): Partial<Record<AnalyticsWidgetId, WidgetDisplayOptions>> | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const out: Partial<Record<AnalyticsWidgetId, WidgetDisplayOptions>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isAnalyticsWidgetId(key)) continue
    if (!value || typeof value !== "object") continue
    const opts: WidgetDisplayOptions = {}
    for (const [optKey, optVal] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (
        typeof optVal === "string" ||
        typeof optVal === "number" ||
        typeof optVal === "boolean"
      ) {
        opts[optKey] = optVal
      }
    }
    out[key] = opts
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function itemToDocument(
  item: Record<string, unknown>,
  fallbackClientId: string,
  fallbackSub: string
): AnalyticsLayoutDocument {
  const widgetIds = sanitizeWidgetIds(item.widgetIds)
  const layouts = sanitizeLayouts(item.layouts)

  // Drop layout cells for unknown / removed widgets; keep known ids only.
  const allowed = new Set(widgetIds)
  const filterLayout = (cells: AnalyticsGridItem[]) =>
    cells.filter((cell) => allowed.has(cell.i))

  const document: AnalyticsLayoutDocument = {
    version: ANALYTICS_LAYOUT_VERSION,
    clientId: String(item.clientId ?? item.client_id ?? fallbackClientId),
    cognitoSub: String(item.cognitoSub ?? fallbackSub),
    widgetIds,
    layouts: {
      lg: filterLayout(layouts.lg),
      md: filterLayout(layouts.md),
      sm: filterLayout(layouts.sm),
    },
    widgetOptions: sanitizeWidgetOptions(item.widgetOptions),
    updatedAt: String(item.updatedAt ?? new Date().toISOString()),
  }

  const parsed = analyticsLayoutDocumentSchema.safeParse(document)
  if (parsed.success) return parsed.data

  return buildDefaultAnalyticsLayout(fallbackClientId, fallbackSub)
}

export async function getAnalyticsLayout(
  clientId: string,
  cognitoSub: string
): Promise<AnalyticsLayoutDocument> {
  const id = analyticsLayoutId(cognitoSub)
  const res = await getDynamo().send(
    new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  if (!res.Item) {
    return buildDefaultAnalyticsLayout(clientId, cognitoSub)
  }
  return itemToDocument(
    res.Item as Record<string, unknown>,
    clientId,
    cognitoSub
  )
}

export interface AnalyticsLayoutPutInput {
  version: typeof ANALYTICS_LAYOUT_VERSION
  widgetIds: AnalyticsWidgetId[]
  layouts: AnalyticsResponsiveLayouts
  widgetOptions?: Partial<Record<AnalyticsWidgetId, WidgetDisplayOptions>>
}

export async function putAnalyticsLayout(
  clientId: string,
  cognitoSub: string,
  input: AnalyticsLayoutPutInput
): Promise<AnalyticsLayoutDocument> {
  const now = new Date().toISOString()
  const widgetIds = sanitizeWidgetIds(input.widgetIds)
  const layouts = sanitizeLayouts(input.layouts)
  const allowed = new Set(widgetIds)
  const filterLayout = (cells: AnalyticsGridItem[]) =>
    cells.filter((cell) => allowed.has(cell.i))

  const document: AnalyticsLayoutDocument = {
    version: ANALYTICS_LAYOUT_VERSION,
    clientId,
    cognitoSub,
    widgetIds,
    layouts: {
      lg: filterLayout(layouts.lg),
      md: filterLayout(layouts.md),
      sm: filterLayout(layouts.sm),
    },
    widgetOptions: sanitizeWidgetOptions(input.widgetOptions),
    updatedAt: now,
  }

  const parsed = analyticsLayoutDocumentSchema.parse(document)
  const id = analyticsLayoutId(cognitoSub)

  await getDynamo().send(
    new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        client_id: clientId,
        id,
        type: "analytics_layout",
        version: parsed.version,
        clientId: parsed.clientId,
        cognitoSub: parsed.cognitoSub,
        widgetIds: parsed.widgetIds,
        layouts: parsed.layouts,
        widgetOptions: parsed.widgetOptions,
        updatedAt: parsed.updatedAt,
      },
    })
  )

  return parsed
}

/** Delete saved layout so the next GET returns the six-widget default. */
export async function deleteAnalyticsLayout(
  clientId: string,
  cognitoSub: string
): Promise<AnalyticsLayoutDocument> {
  const id = analyticsLayoutId(cognitoSub)
  await getDynamo().send(
    new DeleteCommand({
      TableName: CONTENT_TABLE,
      Key: { client_id: clientId, id },
    })
  )
  return buildDefaultAnalyticsLayout(clientId, cognitoSub)
}

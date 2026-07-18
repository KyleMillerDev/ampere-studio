/**
 * Zod contracts shared by analytics API routes and layout persistence.
 * Keep in sync with `lib/analytics/types.ts`.
 */

import { z } from "zod"

import {
  ADVANCED_WIDGET_IDS,
  ANALYTICS_LAYOUT_VERSION,
  DEFAULT_WIDGET_IDS,
} from "@/lib/analytics/types"

const widgetIdSchema = z.enum([
  ...DEFAULT_WIDGET_IDS,
  ...ADVANCED_WIDGET_IDS,
])

export const analyticsDateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const analyticsFilterDimensionSchema = z.enum([
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

export const analyticsFilterOperatorSchema = z.enum([
  "is",
  "is_not",
  "contains",
  "does_not_contain",
])

export const analyticsFilterClauseSchema = z.object({
  id: z.string().min(1).max(80),
  dimension: analyticsFilterDimensionSchema,
  operator: analyticsFilterOperatorSchema,
  values: z.array(z.string().min(1).max(500)).min(1).max(50),
})

export const analyticsGlobalFiltersSchema = z.object({
  dateRange: analyticsDateRangeSchema,
  comparisonRange: analyticsDateRangeSchema.nullable(),
  granularity: z.enum(["hour", "day", "week", "month"]),
  clauses: z.array(analyticsFilterClauseSchema).max(40),
})

export const analyticsDashboardRequestSchema = z.object({
  widgetIds: z.array(widgetIdSchema).min(1).max(48),
  filters: analyticsGlobalFiltersSchema,
})

export const analyticsFilterOptionsRequestSchema = z.object({
  dimension: analyticsFilterDimensionSchema,
  search: z.string().max(200).optional(),
  filters: analyticsGlobalFiltersSchema,
  limit: z.number().int().min(1).max(100).optional(),
})

export const analyticsGridItemSchema = z.object({
  i: widgetIdSchema,
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(500),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
  minW: z.number().int().min(1).max(12).optional(),
  minH: z.number().int().min(1).max(24).optional(),
  maxW: z.number().int().min(1).max(12).optional(),
  maxH: z.number().int().min(1).max(24).optional(),
  static: z.boolean().optional(),
})

export const analyticsResponsiveLayoutsSchema = z.object({
  lg: z.array(analyticsGridItemSchema).max(48),
  md: z.array(analyticsGridItemSchema).max(48),
  sm: z.array(analyticsGridItemSchema).max(48),
})

/** Client PUT body; server fills clientId, cognitoSub, updatedAt. */
export const analyticsLayoutPutSchema = z.object({
  version: z.literal(ANALYTICS_LAYOUT_VERSION),
  widgetIds: z.array(widgetIdSchema).min(1).max(48),
  layouts: analyticsResponsiveLayoutsSchema,
  widgetOptions: z
    .record(widgetIdSchema, z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])))
    .optional(),
})

export const analyticsLayoutDocumentSchema = z.object({
  version: z.literal(ANALYTICS_LAYOUT_VERSION),
  clientId: z.string().min(1).max(120),
  cognitoSub: z.string().min(1).max(128),
  widgetIds: z.array(widgetIdSchema).min(1).max(48),
  layouts: analyticsResponsiveLayoutsSchema,
  widgetOptions: z
    .record(widgetIdSchema, z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])))
    .optional(),
  updatedAt: z.string().min(1),
})

export type AnalyticsDashboardRequestInput = z.infer<
  typeof analyticsDashboardRequestSchema
>
export type AnalyticsFilterOptionsRequestInput = z.infer<
  typeof analyticsFilterOptionsRequestSchema
>
export type AnalyticsLayoutPutInput = z.infer<typeof analyticsLayoutPutSchema>
export type AnalyticsLayoutDocumentInput = z.infer<
  typeof analyticsLayoutDocumentSchema
>

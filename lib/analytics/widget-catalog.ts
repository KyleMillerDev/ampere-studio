/**
 * Client-safe widget catalog data.
 *
 * Mirrors the NEEDS_TRACKING map from lib/posthog/widgets.ts (server-only)
 * so UI components can display availability without importing server modules.
 */

import type { AnalyticsWidgetId, WidgetAvailability, WidgetCategory } from "@/lib/analytics/types"

// ─── Needs-tracking reasons (mirrors lib/posthog/widgets.ts) ─────────────────

export const WIDGET_NEEDS_TRACKING: Partial<Record<AnalyticsWidgetId, string>> =
  {
    scroll_depth: "Scroll depth events are not configured for this project yet.",
    outbound_links: "Outbound link click tracking is not configured yet.",
    downloads: "File download tracking is not configured yet.",
    site_search: "Site search events are not configured yet.",
    page_paths: "Path analysis requires additional session path tracking.",
    page_transitions: "Page transition tracking is not configured yet.",
    engaged_visits: "Engaged-visit definitions are not configured yet.",
    visit_frequency: "Visit frequency cohorts are not configured yet.",
    retention: "Retention cohorts are not enabled for this dashboard yet.",
    time_on_page: "Time-on-page requires custom timing events.",
    campaigns: "Campaign grouping needs consistent UTM campaign tagging.",
    landing_pages_by_source:
      "Landing page by source needs combined session and source tagging.",
    paid_vs_organic: "Paid vs organic needs channel classification rules.",
    timezones: "Visitor timezone capture is not configured yet.",
    browser_versions: "Browser version breakdown is not enabled yet.",
    os_versions: "OS version breakdown is not enabled yet.",
    goal_completions: "Define goals or conversion events in PostHog first.",
    conversion_rate: "Define conversion goals before measuring rate.",
    conversion_trend: "Define conversion goals before measuring trend.",
    funnels: "Funnels require a configured multi-step conversion path.",
    form_submissions: "Form submission events are not configured yet.",
    revenue: "Revenue properties are not captured on events yet.",
    core_web_vitals: "Web vitals events are not being captured yet.",
    slow_pages: "Performance timing events are not being captured yet.",
    errors_404: "404 / error page tracking is not configured yet.",
  }

// ─── Catalog entry ─────────────────────────────────────────────────────────────

export interface CatalogWidget {
  id: AnalyticsWidgetId
  title: string
  description: string
  category: WidgetCategory
  availability: WidgetAvailability
  /** Default grid size on 12-col layout. */
  defaultSize: { w: number; h: number }
}

function avail(id: AnalyticsWidgetId): WidgetAvailability {
  const reason = WIDGET_NEEDS_TRACKING[id]
  return reason ? { status: "needs_tracking", reason } : { status: "ready" }
}

// ─── Full widget catalog ───────────────────────────────────────────────────────

export const WIDGET_CATALOG: CatalogWidget[] = [
  // Default
  {
    id: "visitors",
    title: "Visitors",
    description: "Unique visitors in the selected period.",
    category: "default",
    availability: avail("visitors"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "pageviews",
    title: "Pageviews",
    description: "Total page loads in the selected period.",
    category: "default",
    availability: avail("pageviews"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "bounce_rate",
    title: "Bounce rate",
    description: "Sessions with a single pageview and no interaction.",
    category: "default",
    availability: avail("bounce_rate"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "visitors_over_time",
    title: "Visitors over time",
    description: "Unique visitor trend across the selected date range.",
    category: "default",
    availability: avail("visitors_over_time"),
    defaultSize: { w: 12, h: 4 },
  },
  {
    id: "top_pages",
    title: "Top pages",
    description: "Most visited pages ranked by visitor count.",
    category: "default",
    availability: avail("top_pages"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "traffic_sources",
    title: "Traffic sources",
    description: "Where your visitors came from.",
    category: "default",
    availability: avail("traffic_sources"),
    defaultSize: { w: 6, h: 4 },
  },

  // Audience
  {
    id: "sessions",
    title: "Sessions",
    description: "Total visits including repeat visits from the same person.",
    category: "audience",
    availability: avail("sessions"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "new_vs_returning",
    title: "New vs returning",
    description: "Split between first-time and repeat visitors.",
    category: "audience",
    availability: avail("new_vs_returning"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "session_duration",
    title: "Session duration",
    description: "Average time visitors spend per visit.",
    category: "audience",
    availability: avail("session_duration"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "pages_per_session",
    title: "Pages per session",
    description: "Average number of pages viewed each visit.",
    category: "audience",
    availability: avail("pages_per_session"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "engaged_visits",
    title: "Engaged visits",
    description: "Visits meeting a configured engagement threshold.",
    category: "audience",
    availability: avail("engaged_visits"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "visit_frequency",
    title: "Visit frequency",
    description: "How often visitors return to the site.",
    category: "audience",
    availability: avail("visit_frequency"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "retention",
    title: "Retention",
    description: "Cohort-based visitor return rate over time.",
    category: "audience",
    availability: avail("retention"),
    defaultSize: { w: 12, h: 4 },
  },
  {
    id: "time_of_day",
    title: "Time of day",
    description: "Traffic distribution by hour of the day.",
    category: "audience",
    availability: avail("time_of_day"),
    defaultSize: { w: 8, h: 4 },
  },
  {
    id: "day_of_week",
    title: "Day of week",
    description: "Traffic distribution by day of the week.",
    category: "audience",
    availability: avail("day_of_week"),
    defaultSize: { w: 8, h: 4 },
  },

  // Content
  {
    id: "entry_pages",
    title: "Entry pages",
    description: "First pages visitors land on when they arrive.",
    category: "content",
    availability: avail("entry_pages"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "exit_pages",
    title: "Exit pages",
    description: "Last pages visitors were on before leaving.",
    category: "content",
    availability: avail("exit_pages"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "time_on_page",
    title: "Time on page",
    description: "Average time spent on individual pages.",
    category: "content",
    availability: avail("time_on_page"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "scroll_depth",
    title: "Scroll depth",
    description: "How far down visitors scroll on pages.",
    category: "content",
    availability: avail("scroll_depth"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "outbound_links",
    title: "Outbound links",
    description: "External links that visitors click.",
    category: "content",
    availability: avail("outbound_links"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "downloads",
    title: "Downloads",
    description: "File downloads tracked on the site.",
    category: "content",
    availability: avail("downloads"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "site_search",
    title: "Site search",
    description: "What visitors searched for on-site.",
    category: "content",
    availability: avail("site_search"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "page_paths",
    title: "Page paths",
    description: "Common navigation paths through the site.",
    category: "content",
    availability: avail("page_paths"),
    defaultSize: { w: 12, h: 4 },
  },
  {
    id: "page_transitions",
    title: "Page transitions",
    description: "Which pages visitors move between most.",
    category: "content",
    availability: avail("page_transitions"),
    defaultSize: { w: 12, h: 4 },
  },

  // Acquisition
  {
    id: "referrers",
    title: "Referrers",
    description: "Sites that sent visitors to yours.",
    category: "acquisition",
    availability: avail("referrers"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "channels",
    title: "Channels",
    description: "Traffic grouped by marketing channel type.",
    category: "acquisition",
    availability: avail("channels"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "utm_source",
    title: "UTM source",
    description: "Traffic broken down by utm_source parameter.",
    category: "acquisition",
    availability: avail("utm_source"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "utm_medium",
    title: "UTM medium",
    description: "Traffic broken down by utm_medium parameter.",
    category: "acquisition",
    availability: avail("utm_medium"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "utm_campaign",
    title: "UTM campaign",
    description: "Traffic broken down by utm_campaign parameter.",
    category: "acquisition",
    availability: avail("utm_campaign"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "utm_content",
    title: "UTM content",
    description: "Traffic broken down by utm_content parameter.",
    category: "acquisition",
    availability: avail("utm_content"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "utm_term",
    title: "UTM term",
    description: "Traffic broken down by utm_term parameter.",
    category: "acquisition",
    availability: avail("utm_term"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Grouped campaign performance.",
    category: "acquisition",
    availability: avail("campaigns"),
    defaultSize: { w: 8, h: 4 },
  },
  {
    id: "landing_pages_by_source",
    title: "Landing pages by source",
    description: "Top landing pages broken down by traffic source.",
    category: "acquisition",
    availability: avail("landing_pages_by_source"),
    defaultSize: { w: 8, h: 4 },
  },
  {
    id: "paid_vs_organic",
    title: "Paid vs organic",
    description: "Comparison of paid and organic channel performance.",
    category: "acquisition",
    availability: avail("paid_vs_organic"),
    defaultSize: { w: 6, h: 4 },
  },

  // Geography
  {
    id: "countries",
    title: "Countries",
    description: "Visitor distribution by country.",
    category: "geography",
    availability: avail("countries"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "regions",
    title: "Regions",
    description: "Visitor distribution by state or province.",
    category: "geography",
    availability: avail("regions"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "cities",
    title: "Cities",
    description: "Visitor distribution by city.",
    category: "geography",
    availability: avail("cities"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "timezones",
    title: "Timezones",
    description: "Visitor distribution by timezone.",
    category: "geography",
    availability: avail("timezones"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "languages",
    title: "Languages",
    description: "Visitor browser language settings.",
    category: "geography",
    availability: avail("languages"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "geo_map",
    title: "Geographic map",
    description: "World map showing visitor distribution.",
    category: "geography",
    availability: avail("geo_map"),
    defaultSize: { w: 12, h: 4 },
  },

  // Technology
  {
    id: "devices",
    title: "Devices",
    description: "Breakdown by device type: desktop, mobile, and tablet.",
    category: "technology",
    availability: avail("devices"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "browsers",
    title: "Browsers",
    description: "Which browsers visitors use.",
    category: "technology",
    availability: avail("browsers"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "browser_versions",
    title: "Browser versions",
    description: "Browser breakdown by version number.",
    category: "technology",
    availability: avail("browser_versions"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "operating_systems",
    title: "Operating systems",
    description: "Which operating systems visitors use.",
    category: "technology",
    availability: avail("operating_systems"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "os_versions",
    title: "OS versions",
    description: "Operating system breakdown by version.",
    category: "technology",
    availability: avail("os_versions"),
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: "screen_sizes",
    title: "Screen sizes",
    description: "Display resolution breakdown.",
    category: "technology",
    availability: avail("screen_sizes"),
    defaultSize: { w: 4, h: 4 },
  },

  // Goals
  {
    id: "goal_completions",
    title: "Goal completions",
    description: "Number of times goals were completed.",
    category: "goals",
    availability: avail("goal_completions"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "conversion_rate",
    title: "Conversion rate",
    description: "Percentage of visitors completing a goal.",
    category: "goals",
    availability: avail("conversion_rate"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "conversion_trend",
    title: "Conversion trend",
    description: "Conversion rate over time.",
    category: "goals",
    availability: avail("conversion_trend"),
    defaultSize: { w: 8, h: 4 },
  },
  {
    id: "funnels",
    title: "Funnels",
    description: "Multi-step conversion funnel analysis.",
    category: "goals",
    availability: avail("funnels"),
    defaultSize: { w: 12, h: 4 },
  },
  {
    id: "form_submissions",
    title: "Form submissions",
    description: "Tracked form submission events.",
    category: "goals",
    availability: avail("form_submissions"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "revenue",
    title: "Revenue",
    description: "Revenue captured from tracked events.",
    category: "goals",
    availability: avail("revenue"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "custom_events",
    title: "Custom events",
    description: "Non-standard events tracked on your site.",
    category: "goals",
    availability: avail("custom_events"),
    defaultSize: { w: 8, h: 4 },
  },

  // Quality / Real time
  {
    id: "core_web_vitals",
    title: "Core Web Vitals",
    description: "LCP, INP, and CLS performance scores from real sessions.",
    category: "quality",
    availability: avail("core_web_vitals"),
    defaultSize: { w: 8, h: 4 },
  },
  {
    id: "slow_pages",
    title: "Slow pages",
    description: "Pages with high measured load times.",
    category: "quality",
    availability: avail("slow_pages"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "errors_404",
    title: "404 errors",
    description: "Pages generating not-found errors.",
    category: "quality",
    availability: avail("errors_404"),
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: "active_visitors",
    title: "Active right now",
    description: "People on the site in the last 5 minutes.",
    category: "quality",
    availability: avail("active_visitors"),
    defaultSize: { w: 4, h: 2 },
  },
  {
    id: "active_pages",
    title: "Active pages",
    description: "Pages being viewed right now.",
    category: "quality",
    availability: avail("active_pages"),
    defaultSize: { w: 8, h: 4 },
  },
  {
    id: "live_sources",
    title: "Live sources",
    description: "Where current visitors came from.",
    category: "quality",
    availability: avail("live_sources"),
    defaultSize: { w: 4, h: 4 },
  },
]

// ─── Category metadata ─────────────────────────────────────────────────────────

export const CATALOG_CATEGORIES: { key: WidgetCategory; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "audience", label: "Audience" },
  { key: "content", label: "Content" },
  { key: "acquisition", label: "Acquisition" },
  { key: "geography", label: "Geography" },
  { key: "technology", label: "Technology" },
  { key: "goals", label: "Goals" },
  { key: "quality", label: "Quality & Real time" },
]

/** Map from widget ID to catalog entry for O(1) lookup. */
export const CATALOG_BY_ID: Partial<Record<AnalyticsWidgetId, CatalogWidget>> =
  Object.fromEntries(WIDGET_CATALOG.map((w) => [w.id, w]))

/**
 * Education content integrity: glossary coverage, beginner labels,
 * and no user-facing PostHog strings in analytics UI modules.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { WIDGET_CATALOG } from "@/lib/analytics/widget-catalog"

import { GLOSSARY_TERMS } from "./analytics-101-dialog"
import {
  WIDGET_TABLE_NAME_LABELS,
  WIDGET_TITLES,
} from "./analytics-help-data"
import { DIMENSION_LABELS } from "./analytics-filter-utils"

/** Terms required by the beginner analytics education plan. */
const REQUIRED_GLOSSARY_TERM_IDS = [
  "visitor",
  "pageview",
  "visit",
  "new_vs_returning",
  "source",
  "direct_traffic",
  "referring_website",
  "channel",
  "organic_search",
  "paid_traffic",
  "campaign",
  "utm_label",
  "bounce_rate",
  "time_per_visit",
  "pages_per_visit",
  "conversion",
  "goal",
  "conversion_rate",
  "first_page",
  "last_page",
  "filter",
  "comparison_period",
] as const

/** Plan-mandated beginner titles keyed by stable widget id. */
const BEGINNER_WIDGET_TITLES: Record<string, string> = {
  traffic_sources: "How people found your site",
  sessions: "Visits",
  referrers: "Websites that sent visitors",
  entry_pages: "First pages people saw",
  exit_pages: "Last pages people saw",
  session_duration: "Time per visit",
  pages_per_session: "Pages per visit",
  pageviews: "Page views",
  new_returning_by_source: "New and returning by source",
}

const BEGINNER_DIMENSION_LABELS: Partial<Record<keyof typeof DIMENSION_LABELS, string>> =
  {
    entry_page: "First page",
    exit_page: "Last page",
    referrer: "Referring website",
    utm_source: "Campaign source",
    utm_medium: "Campaign medium",
  }

const ANALYTICS_UI_DIR = join(process.cwd(), "components", "cms", "analytics")

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue
    out.push(full)
  }
  return out
}

/** Remove line/block comments so provider names in docs do not fail the scan. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

/**
 * Collect double/single-quoted and template-literal string contents.
 * Skips the PostHog scrub regex source in education-actions.ts.
 */
function extractStringLiterals(source: string, filePath: string): string[] {
  const stripped = stripComments(source)
  const literals: string[] = []
  const pattern = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(stripped)) !== null) {
    const raw = match[2] ?? ""
    // Allow the intentional scrub pattern in education-actions.ts
    if (
      filePath.endsWith("education-actions.ts") &&
      /\\bPostHog\\b/i.test(raw)
    ) {
      continue
    }
    literals.push(raw)
  }
  return literals
}

describe("analytics education glossary coverage", () => {
  it("includes every required Analytics 101 term id", () => {
    const ids = new Set(GLOSSARY_TERMS.map((t) => t.id))
    const missing = REQUIRED_GLOSSARY_TERM_IDS.filter((id) => !ids.has(id))
    expect(missing, `Missing glossary terms: ${missing.join(", ")}`).toEqual([])
  })

  it("gives every glossary term a definition and example", () => {
    const incomplete = GLOSSARY_TERMS.filter(
      (t) => !t.term.trim() || !t.definition.trim() || !t.example.trim()
    ).map((t) => t.id)
    expect(incomplete).toEqual([])
  })

  it("covers all five glossary categories", () => {
    const categories = new Set(GLOSSARY_TERMS.map((t) => t.category))
    for (const required of [
      "getting_started",
      "how_people_arrived",
      "what_people_did",
      "results",
      "filters",
    ] as const) {
      expect(categories.has(required), `Missing category ${required}`).toBe(true)
    }
  })
})

describe("analytics beginner label mappings", () => {
  it("maps key widget ids to beginner-first titles", () => {
    const mismatches = Object.entries(BEGINNER_WIDGET_TITLES).flatMap(
      ([id, expected]) => {
        const actual = WIDGET_TITLES[id]
        return actual === expected
          ? []
          : [`WIDGET_TITLES.${id}: expected "${expected}", got "${actual}"`]
      }
    )
    expect(mismatches, mismatches.join("\n")).toEqual([])
  })

  it("keeps the widget catalog titles aligned with beginner WIDGET_TITLES", () => {
    const mismatches = Object.keys(BEGINNER_WIDGET_TITLES).flatMap((id) => {
      const expected = WIDGET_TITLES[id]
      const catalog = WIDGET_CATALOG.find((w) => w.id === id)
      if (!catalog) return [`Catalog missing widget ${id}`]
      return catalog.title === expected
        ? []
        : [
            `WIDGET_CATALOG.${id}.title: expected "${expected}", got "${catalog.title}"`,
          ]
    })
    expect(mismatches, mismatches.join("\n")).toEqual([])
  })

  it("uses beginner filter dimension labels for acquisition and entry/exit", () => {
    const mismatches = Object.entries(BEGINNER_DIMENSION_LABELS).flatMap(
      ([dimension, expected]) => {
        const actual =
          DIMENSION_LABELS[dimension as keyof typeof DIMENSION_LABELS]
        return actual === expected
          ? []
          : [
              `DIMENSION_LABELS.${dimension}: expected "${expected}", got "${actual}"`,
            ]
      }
    )
    expect(mismatches, mismatches.join("\n")).toEqual([])
  })

  it("gives ranked tables context-specific name columns for core widgets", () => {
    for (const id of [
      "top_pages",
      "entry_pages",
      "exit_pages",
      "traffic_sources",
      "referrers",
    ] as const) {
      expect(
        WIDGET_TABLE_NAME_LABELS[id],
        `Missing table name label for ${id}`
      ).toBeTruthy()
      expect(WIDGET_TABLE_NAME_LABELS[id]).not.toMatch(/Page \/ Source/i)
    }
  })
})

describe("analytics UI provider-name privacy", () => {
  it("does not expose PostHog in user-facing string literals", () => {
    const issues: string[] = []
    for (const file of listSourceFiles(ANALYTICS_UI_DIR)) {
      const source = readFileSync(file, "utf8")
      const rel = relative(process.cwd(), file).replace(/\\/g, "/")
      for (const literal of extractStringLiterals(source, file)) {
        if (/\bPostHog\b/i.test(literal)) {
          issues.push(`${rel}: "${literal.slice(0, 120)}"`)
        }
      }
    }
    expect(issues, issues.join("\n")).toEqual([])
  })
})

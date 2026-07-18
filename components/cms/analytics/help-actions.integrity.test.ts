/**
 * Fails when education next-steps or glossary Show me actions reference
 * unknown widgets, unhandled kinds, bad routes, or missing glossary terms.
 */
import { describe, expect, it } from "vitest"

import { isAnalyticsHelpAction } from "@/lib/analytics/types"

import { GLOSSARY_TERMS } from "./analytics-101-dialog"
import { METRIC_HELP } from "./analytics-help-data"
import {
  EDUCATION_ACTION_KINDS,
  collectMetricHelpActions,
  validateEducationAction,
} from "./education-actions"

describe("analytics help action integrity", () => {
  const glossaryTermIds = new Set(GLOSSARY_TERMS.map((t) => t.id))

  it("converts every MetricHelp nextStep to a typed action", () => {
    const collected = collectMetricHelpActions()
    const stringSteps = collected.filter((c) => c.action === null)
    expect(
      stringSteps,
      stringSteps.map((s) => `${s.source}: ${s.stringStep}`).join("\n")
    ).toEqual([])
  })

  it("validates MetricHelp nextSteps against known targets", () => {
    const issues = collectMetricHelpActions().flatMap(({ source, action }) => {
      if (!action) {
        return [{ source, message: `Plain string next step: ${source}` }]
      }
      return validateEducationAction(action, source, { glossaryTermIds })
    })
    expect(issues, issues.map((i) => `${i.source}: ${i.message}`).join("\n")).toEqual(
      []
    )
  })

  it("validates glossary Show me actions against known targets", () => {
    const issues = GLOSSARY_TERMS.flatMap((term) => {
      if (!term.showMeAction) return []
      return validateEducationAction(
        term.showMeAction,
        `GLOSSARY_TERMS.${term.id}.showMeAction`,
        { glossaryTermIds }
      )
    })
    expect(issues, issues.map((i) => `${i.source}: ${i.message}`).join("\n")).toEqual(
      []
    )
  })

  it("links MetricHelp glossaryTermId values to real glossary terms", () => {
    const bad = Object.values(METRIC_HELP)
      .filter((h) => h.glossaryTermId && !glossaryTermIds.has(h.glossaryTermId))
      .map((h) => `${h.id} -> ${h.glossaryTermId}`)
    expect(bad, bad.join("\n")).toEqual([])
  })

  it("covers every education action kind in the allowlist", () => {
    const kinds = new Set<string>()
    for (const { action } of collectMetricHelpActions()) {
      if (action) kinds.add(action.kind)
    }
    for (const term of GLOSSARY_TERMS) {
      if (term.showMeAction) kinds.add(term.showMeAction.kind)
    }
    for (const kind of EDUCATION_ACTION_KINDS) {
      // open_filter / focus_widget / open_glossary / navigate are required.
      // apply_filter is optional in current copy but must remain in the allowlist.
      if (kind === "apply_filter") continue
      expect(kinds.has(kind), `No help actions use kind "${kind}"`).toBe(true)
    }
  })

  it("rejects unknown action kinds at the type-guard boundary", () => {
    expect(isAnalyticsHelpAction("plain string")).toBe(false)
    expect(
      isAnalyticsHelpAction({
        kind: "focus_widget",
        label: "x",
        widgetId: "visitors",
      })
    ).toBe(true)
  })

  it("wires Visitors help to the new_returning_by_source widget", () => {
    const visitors = METRIC_HELP.visitors
    expect(visitors).toBeTruthy()
    const focusSource = visitors.nextSteps.find(
      (step) =>
        isAnalyticsHelpAction(step) &&
        step.kind === "focus_widget" &&
        step.widgetId === "new_returning_by_source"
    )
    expect(focusSource, "Visitors next steps must focus new_returning_by_source").toBeTruthy()
  })

  it("includes at least one navigate action to /content", () => {
    const navigate = collectMetricHelpActions().filter(
      (c) => c.action?.kind === "navigate" && c.action.href === "/content"
    )
    expect(navigate.length).toBeGreaterThan(0)
  })

  it("includes open_filter actions for filter education", () => {
    const openFilter = collectMetricHelpActions().filter(
      (c) => c.action?.kind === "open_filter"
    )
    expect(openFilter.length).toBeGreaterThan(0)
  })
})

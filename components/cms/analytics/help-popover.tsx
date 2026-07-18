"use client"

import { useState } from "react"
import {
  CircleHelpIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  MinusIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AnalyticsHelpAction, MetricHelp } from "@/lib/analytics/types"
import { isAnalyticsHelpAction, metricHelpStepLabel } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { METRIC_HELP } from "./analytics-help-data"
import { useEducationActions } from "./education-actions-context"

// ─── Direction card ───────────────────────────────────────────────────────────

function DirectionCard({ preference }: { preference: MetricHelp["preference"] }) {
  if (preference === "higher") {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Higher is better
          </span>
        </div>
        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
          Growth in this number is a positive sign. Look for upward trends over
          time rather than reacting to a single day.
        </p>
      </div>
    )
  }

  if (preference === "lower") {
    return (
      <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingDownIcon className="size-3.5 shrink-0 text-rose-500" aria-hidden />
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
            Lower is better
          </span>
        </div>
        <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-400/80 leading-relaxed">
          A drop in this number is a positive sign. Sustained decreases over
          time are more meaningful than a single low reading.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-blue-400/30 bg-blue-500/8 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <MinusIcon className="size-3.5 shrink-0 text-blue-500/70" aria-hidden />
        <span className="text-xs font-semibold text-blue-700/80 dark:text-blue-400/80">
          Context matters
        </span>
      </div>
      <p className="mt-1 text-xs text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
        Neither higher nor lower is automatically good or bad for this metric.
        Compare to your own earlier periods and consider the source and page
        type to get the real picture.
      </p>
    </div>
  )
}

// ─── HelpContent ─────────────────────────────────────────────────────────────

function HelpContent({
  help,
  onAction,
}: {
  help: MetricHelp
  onAction: ((action: AnalyticsHelpAction) => void) | null
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-semibold text-foreground">{help.label}</p>
        <p className="mt-1 text-muted-foreground leading-relaxed">{help.meaning}</p>
        {help.glossaryTermId && onAction && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 mt-1.5 text-xs"
            onClick={() =>
              onAction({
                kind: "open_glossary",
                label: "Learn more in Analytics 101",
                termId: help.glossaryTermId!,
              })
            }
          >
            Learn more in Analytics 101
          </Button>
        )}
      </div>

      <div className="rounded-md bg-muted/60 px-3 py-2.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          How Ampere Sites measures it
        </span>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {help.howCounted}
        </p>
      </div>

      <DirectionCard preference={help.preference} />

      {help.referenceRange && (
        <div className="rounded-md bg-muted/40 px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Typical range
          </span>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {help.referenceRange}
          </p>
        </div>
      )}

      {help.contextNotes && (
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          {help.contextNotes}
        </p>
      )}

      {help.nextSteps.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            What to try next
          </span>
          <ul className="mt-1.5 space-y-1.5">
            {help.nextSteps.map((step, i) => {
              const label = metricHelpStepLabel(step)
              const actionable = isAnalyticsHelpAction(step) && onAction
              return (
                <li key={i}>
                  {actionable ? (
                    <button
                      type="button"
                      onClick={() => onAction(step)}
                      className={cn(
                        "flex w-full gap-2 rounded-md px-1.5 py-1 text-left text-xs text-primary",
                        "hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      <span className="mt-0.5 shrink-0" aria-hidden>
                        &#8250;
                      </span>
                      <span className="leading-relaxed">
                        {label}
                        {step.description ? (
                          <span className="mt-0.5 block text-muted-foreground font-normal">
                            {step.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ) : (
                    <div className="flex gap-2 px-1.5 py-1 text-xs text-muted-foreground">
                      <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
                        &#8250;
                      </span>
                      <span className="leading-relaxed">{label}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── HelpPopover ─────────────────────────────────────────────────────────────

interface HelpPopoverProps {
  /** Metric help ID key or a full MetricHelp object. */
  metricId?: string
  help?: MetricHelp
  side?: "top" | "right" | "bottom" | "left"
  className?: string
}

/**
 * A small circular ? button that opens an educational popover.
 * Pass either a `metricId` to look up from METRIC_HELP, or a raw `help` object.
 *
 * Next-step buttons and Learn more use the dashboard education dispatcher
 * when rendered inside EducationActionsProvider.
 */
export function HelpPopover({
  metricId,
  help: helpProp,
  side = "top",
  className,
}: HelpPopoverProps) {
  const help = helpProp ?? (metricId ? METRIC_HELP[metricId] : null)
  const onAction = useEducationActions()
  const [open, setOpen] = useState(false)

  if (!help) return null

  function dispatch(action: AnalyticsHelpAction) {
    setOpen(false)
    // Close the popover before focusing/scrolling elsewhere.
    queueMicrotask(() => onAction?.(action))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Learn about ${help.label}`}
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/60",
            "ring-offset-background transition-colors",
            "hover:text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            className
          )}
        >
          <CircleHelpIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className="w-84 max-h-[min(80dvh,28rem)] overflow-y-auto p-4"
        sideOffset={6}
      >
        <HelpContent help={help} onAction={onAction ? dispatch : null} />
      </PopoverContent>
    </Popover>
  )
}

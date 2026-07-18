"use client"

import { CircleHelpIcon } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { MetricHelp } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

import { METRIC_HELP } from "./analytics-help-data"

// ─── HelpContent ─────────────────────────────────────────────────────────────

function HelpContent({ help }: { help: MetricHelp }) {
  const preferenceText =
    help.preference === "higher"
      ? "Higher is generally better."
      : help.preference === "lower"
        ? "Lower is generally better."
        : "Neither direction is inherently better; context matters."

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-semibold text-foreground">{help.label}</p>
        <p className="mt-1 text-muted-foreground leading-relaxed">{help.meaning}</p>
      </div>

      <div className="rounded-md bg-muted/60 px-3 py-2 space-y-1.5">
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            How it is counted
          </span>
          <p className="mt-0.5 text-muted-foreground">{help.howCounted}</p>
        </div>

        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Direction
          </span>
          <p className="mt-0.5 text-muted-foreground">{preferenceText}</p>
        </div>

        {help.referenceRange && (
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Reference range
            </span>
            <p className="mt-0.5 text-muted-foreground">{help.referenceRange}</p>
          </div>
        )}
      </div>

      {help.contextNotes && (
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          {help.contextNotes}
        </p>
      )}

      {help.nextSteps.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Next steps
          </span>
          <ul className="mt-1 space-y-1">
            {help.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-primary">&#8250;</span>
                {step}
              </li>
            ))}
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
 */
export function HelpPopover({
  metricId,
  help: helpProp,
  side = "top",
  className,
}: HelpPopoverProps) {
  const help = helpProp ?? (metricId ? METRIC_HELP[metricId] : null)
  if (!help) return null

  return (
    <Popover>
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
        className="w-80 p-4"
        sideOffset={6}
      >
        <HelpContent help={help} />
      </PopoverContent>
    </Popover>
  )
}

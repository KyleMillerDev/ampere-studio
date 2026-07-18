"use client"

import { useState, useMemo, useId, useEffect } from "react"
import { SearchIcon, BookOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { AnalyticsHelpAction } from "@/lib/analytics/types"

// ─── Glossary data ────────────────────────────────────────────────────────────

export type GlossaryCategory =
  | "getting_started"
  | "how_people_arrived"
  | "what_people_did"
  | "results"
  | "filters"

export interface GlossaryTerm {
  /** Stable ID referenced by MetricHelp.glossaryTermId. */
  id: string
  term: string
  category: GlossaryCategory
  definition: string
  example: string
  /**
   * "Show me" action stub.
   * The `wire-help-actions` integration phase adds the dispatcher.
   * When null, the Show me button is not rendered.
   */
  showMeAction: AnalyticsHelpAction | null
}

const CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  getting_started: "Getting started",
  how_people_arrived: "How people arrived",
  what_people_did: "What people did",
  results: "Results",
  filters: "Filters",
}

const CATEGORY_ORDER: GlossaryCategory[] = [
  "getting_started",
  "how_people_arrived",
  "what_people_did",
  "results",
  "filters",
]

/**
 * Canonical glossary terms for the Analytics 101 dialog.
 *
 * showMeAction stubs use stable kind/widgetId/termId values so the
 * `wire-help-actions` integration phase can register handlers without
 * modifying this file. Actions with kind "focus_widget" that reference
 * a widget not on the user's layout will be handled by the dispatcher
 * (add then focus). Actions with kind "open_glossary" scroll this dialog
 * to the matching term.
 */
export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // ── Getting started ────────────────────────────────────────────────────────
  {
    id: "visitor",
    term: "Visitor",
    category: "getting_started",
    definition:
      "A unique person who came to your site. Each visitor is counted once in a given period, no matter how many pages they read or how many times they returned.",
    example:
      "If the same person visits your site on Monday and again on Friday, they count as one visitor for the week.",
    showMeAction: {
      kind: "focus_widget",
      label: "Show visitors widget",
      widgetId: "visitors",
    },
  },
  {
    id: "pageview",
    term: "Page view",
    category: "getting_started",
    definition:
      "A single page load. One visitor creates a new page view every time they load a page, whether that is the first page or the fifth.",
    example:
      "A visitor who reads your homepage, then your About page, then your Contact page creates three page views in one visit.",
    showMeAction: {
      kind: "focus_widget",
      label: "Show page views widget",
      widgetId: "pageviews",
    },
  },
  {
    id: "visit",
    term: "Visit (session)",
    category: "getting_started",
    definition:
      "A continuous period of activity on your site. A visit starts when someone arrives and ends after 30 minutes of inactivity. One person can have multiple visits in a day.",
    example:
      "If someone browses your site in the morning, closes the tab, then returns in the afternoon, that counts as two visits from one visitor.",
    showMeAction: {
      kind: "focus_widget",
      label: "Show visits widget",
      widgetId: "sessions",
    },
  },
  {
    id: "new_vs_returning",
    term: "New vs returning visitor",
    category: "getting_started",
    definition:
      "A new visitor is someone whose browser has no record of visiting your site before. A returning visitor has been before, and their browser remembers it.",
    example:
      "Someone who clicks your ad for the first time is a new visitor. A client who checks back to read your latest blog post is a returning visitor.",
    showMeAction: {
      kind: "focus_widget",
      label: "Show new vs returning widget",
      widgetId: "new_vs_returning",
    },
  },
  // ── How people arrived ─────────────────────────────────────────────────────
  {
    id: "source",
    term: "Source",
    category: "how_people_arrived",
    definition:
      "The specific place a visitor came from just before they arrived at your site, such as Google, Facebook, or another website.",
    example:
      "A visitor who clicked a link in your Facebook post has the source 'Facebook'. A visitor who typed your address directly has the source 'Direct'.",
    showMeAction: {
      kind: "focus_widget",
      label: "See how people found your site",
      widgetId: "traffic_sources",
    },
  },
  {
    id: "direct_traffic",
    term: "Direct traffic",
    category: "how_people_arrived",
    definition:
      "Visits where no referring source was recorded. This includes people who typed your address directly, used a bookmark, or clicked a link from an app that does not pass referrer information (like many email clients or messaging apps).",
    example:
      "A client who has your website saved as a bookmark and clicks it goes into the Direct bucket.",
    showMeAction: {
      kind: "open_filter",
      label: "Filter to direct traffic",
      dimension: "source",
      values: ["direct"],
    },
  },
  {
    id: "referring_website",
    term: "Referring website",
    category: "how_people_arrived",
    definition:
      "A specific website that linked to your site and sent a visitor through that link.",
    example:
      "If a local business directory lists your website and someone clicks it, that directory shows up as a referring website.",
    showMeAction: {
      kind: "focus_widget",
      label: "See websites that sent visitors",
      widgetId: "referrers",
    },
  },
  {
    id: "channel",
    term: "Channel",
    category: "how_people_arrived",
    definition:
      "A broader grouping of traffic sources. Channels combine individual sources into categories like organic search, paid ads, social media, email, referral, and direct.",
    example:
      "Traffic from Google, Bing, and DuckDuckGo all fall into the Organic Search channel. Traffic from Instagram and Facebook ads fall into Paid Social.",
    showMeAction: {
      kind: "focus_widget",
      label: "See channels breakdown",
      widgetId: "channels",
    },
  },
  {
    id: "organic_search",
    term: "Organic search",
    category: "how_people_arrived",
    definition:
      "Visitors who found your site by searching on Google (or another search engine) and clicking a non-paid result.",
    example:
      "Someone who searches 'wedding videographer Iowa' and clicks your listing arrives as an organic search visitor.",
    showMeAction: {
      kind: "open_filter",
      label: "Filter to organic search",
      dimension: "channel",
      values: ["organic_search"],
    },
  },
  {
    id: "paid_traffic",
    term: "Paid traffic",
    category: "how_people_arrived",
    definition:
      "Visitors who arrived through a paid ad, such as a Google search ad, a Facebook ad, or a sponsored post.",
    example:
      "If you run a Google Ads campaign and someone clicks it, that visit shows up as paid traffic.",
    showMeAction: null,
  },
  {
    id: "campaign",
    term: "Campaign",
    category: "how_people_arrived",
    definition:
      "A named marketing effort you are tracking. Campaigns group links from a single promotion so you can see the total traffic and conversions it drove.",
    example:
      "If you send an email newsletter promoting a summer discount and tag every link with a campaign name, all those clicks appear together under that campaign.",
    showMeAction: {
      kind: "focus_widget",
      label: "See campaigns",
      widgetId: "campaigns",
    },
  },
  {
    id: "utm_label",
    term: "UTM label (campaign tag)",
    category: "how_people_arrived",
    definition:
      "Extra information added to the end of a link that tells your analytics where that click came from. The most common tags are utm_source (the platform), utm_medium (the channel type), and utm_campaign (the campaign name).",
    example:
      "A link in your email newsletter might look like: yoursite.com/?utm_source=newsletter&utm_medium=email&utm_campaign=summer2025. That way you know exactly which email drove the click.",
    showMeAction: {
      kind: "focus_widget",
      label: "See campaign source breakdown",
      widgetId: "utm_source",
    },
  },
  // ── What people did ────────────────────────────────────────────────────────
  {
    id: "bounce_rate",
    term: "Bounce rate",
    category: "what_people_did",
    definition:
      "The percentage of visits where the person left after viewing only one page without clicking, scrolling, or doing anything else. A high bounce rate is not always bad, but it is often a sign that the page did not match what the visitor expected.",
    example:
      "If 100 people visit your homepage and 60 of them leave without clicking anything, your bounce rate is 60 percent.",
    showMeAction: {
      kind: "focus_widget",
      label: "See bounce rate",
      widgetId: "bounce_rate",
    },
  },
  {
    id: "time_per_visit",
    term: "Time per visit",
    category: "what_people_did",
    definition:
      "The average time a visitor spends on your site from their first action to their last before leaving.",
    example:
      "If most visitors read one blog post for about 3 minutes and then leave, your average time per visit would be around 3 minutes.",
    showMeAction: {
      kind: "focus_widget",
      label: "See time per visit",
      widgetId: "session_duration",
    },
  },
  {
    id: "pages_per_visit",
    term: "Pages per visit",
    category: "what_people_did",
    definition:
      "The average number of pages a visitor views during one visit. A higher number usually means people are engaging with your content and exploring further.",
    example:
      "If visitors typically read your homepage, then your services page, then your contact page, your pages per visit would be around 3.",
    showMeAction: {
      kind: "focus_widget",
      label: "See pages per visit",
      widgetId: "pages_per_session",
    },
  },
  {
    id: "first_page",
    term: "First page (entry page)",
    category: "what_people_did",
    definition:
      "The first page a visitor lands on when they arrive at your site. This is often the page linked from search results, social posts, or ads.",
    example:
      "If someone finds your site by searching 'Iowa wedding videographer' and clicks a blog post, that blog post is their entry page, not your homepage.",
    showMeAction: {
      kind: "focus_widget",
      label: "See first pages people saw",
      widgetId: "entry_pages",
    },
  },
  {
    id: "last_page",
    term: "Last page (exit page)",
    category: "what_people_did",
    definition:
      "The last page a visitor was on before they left your site. A high exit rate on a page you want people to move through may signal a problem.",
    example:
      "If many visitors end their visit on your pricing page without contacting you, that page may need a clearer call to action.",
    showMeAction: {
      kind: "focus_widget",
      label: "See last pages people saw",
      widgetId: "exit_pages",
    },
  },
  // ── Results ────────────────────────────────────────────────────────────────
  {
    id: "conversion",
    term: "Conversion",
    category: "results",
    definition:
      "When a visitor completes an action you care about, such as filling out a contact form, clicking a call button, booking a consultation, or making a purchase.",
    example:
      "If your goal is for visitors to contact you, then every form submission counts as a conversion.",
    showMeAction: {
      kind: "focus_widget",
      label: "See goal completions",
      widgetId: "goal_completions",
    },
  },
  {
    id: "goal",
    term: "Goal",
    category: "results",
    definition:
      "A specific conversion action you chose to track, such as a contact form submission, booking request, or phone click.",
    example:
      "If you track contact form submissions as a goal, every completed form counts toward your goal total for the period.",
    showMeAction: {
      kind: "focus_widget",
      label: "See goal completions",
      widgetId: "goal_completions",
    },
  },
  {
    id: "conversion_rate",
    term: "Conversion rate",
    category: "results",
    definition:
      "The percentage of visitors who completed a conversion goal. Calculated as conversions divided by total visitors.",
    example:
      "If 500 people visited your site this month and 15 filled out your contact form, your conversion rate is 3 percent.",
    showMeAction: {
      kind: "focus_widget",
      label: "See conversion rate",
      widgetId: "conversion_rate",
    },
  },
  // ── Filters ────────────────────────────────────────────────────────────────
  {
    id: "filter",
    term: "Filter",
    category: "filters",
    definition:
      "A way to narrow the dashboard to a specific group of visitors. You can filter by traffic source, device type, country, page visited, and more. All widgets update together when a filter is active.",
    example:
      "Filter by 'Device: Mobile' to see how mobile visitors behave differently from desktop visitors. You might find that mobile visitors bounce more, which points to a responsive design opportunity.",
    showMeAction: {
      kind: "open_filter",
      label: "Open the filter builder",
      dimension: "source",
    },
  },
  {
    id: "comparison_period",
    term: "Comparison period",
    category: "filters",
    definition:
      "A second date range shown alongside your main data so you can see whether things improved or declined. The comparison is usually set to the equal previous period automatically.",
    example:
      "If you are looking at the last 30 days, the comparison period is the 30 days before that. An arrow next to a number shows how much it changed.",
    showMeAction: null,
  },
]

// ─── Search and filter logic ──────────────────────────────────────────────────

function useGlossarySearch(query: string) {
  return useMemo(() => {
    if (!query.trim()) return GLOSSARY_TERMS

    const q = query.toLowerCase()
    return GLOSSARY_TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.example.toLowerCase().includes(q)
    )
  }, [query])
}

// ─── Term card ────────────────────────────────────────────────────────────────

interface TermCardProps {
  term: GlossaryTerm
  /** Called when the user presses "Show me". No-op until wire-help-actions lands. */
  onShowMe?: (action: AnalyticsHelpAction) => void
}

function TermCard({ term, onShowMe }: TermCardProps) {
  return (
    <div
      id={`glossary-${term.id}`}
      className="rounded-lg border border-border/60 bg-card px-4 py-3 space-y-2"
    >
      <p className="text-sm font-semibold text-foreground leading-tight">
        {term.term}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {term.definition}
      </p>
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Example
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed italic">
          {term.example}
        </p>
      </div>
      {term.showMeAction && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onShowMe?.(term.showMeAction!)}
          disabled={!onShowMe}
          title={onShowMe ? term.showMeAction.label : "Coming soon"}
        >
          {term.showMeAction.label}
        </Button>
      )}
    </div>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

interface Analytics101DialogProps {
  /** Optional action dispatcher provided by the dashboard. */
  onHelpAction?: (action: AnalyticsHelpAction) => void
  /** Controlled open state (dashboard uses this for open_glossary). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Scroll to and highlight this glossary term when the dialog opens. */
  initialTermId?: string | null
  /** Hide the trigger button when the dashboard owns opening. */
  hideTrigger?: boolean
}

export function Analytics101Dialog({
  onHelpAction,
  open: openProp,
  onOpenChange,
  initialTermId,
  hideTrigger = false,
}: Analytics101DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchId = useId()
  const open = openProp ?? uncontrolledOpen

  function setOpen(next: boolean) {
    onOpenChange?.(next)
    if (openProp === undefined) setUncontrolledOpen(next)
  }

  const results = useGlossarySearch(query)

  // Group visible results by category.
  const grouped = useMemo(() => {
    const map = new Map<GlossaryCategory, GlossaryTerm[]>()
    for (const cat of CATEGORY_ORDER) {
      const items = results.filter((t) => t.category === cat)
      if (items.length > 0) map.set(cat, items)
    }
    return map
  }, [results])

  const isEmpty = results.length === 0

  // Scroll to the requested term after open.
  useEffect(() => {
    if (!open || !initialTermId) return
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`glossary-${initialTermId}`)
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary", "ring-offset-2")
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2")
      }, 2000)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [open, initialTermId])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            aria-label="Open Analytics 101 glossary"
          >
            <BookOpenIcon className="size-3.5 shrink-0" />
            Analytics 101
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5">
          <DialogTitle className="text-base">Analytics 101</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Plain-language definitions for every term in your dashboard.
          </p>

          <div className="relative mt-3">
            <label htmlFor={searchId} className="sr-only">
              Search glossary
            </label>
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden
            />
            <Input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms..."
              className="h-8 pl-8 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </DialogHeader>

        {/* Scrollable term list */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6"
          role="list"
          aria-label="Glossary terms"
          aria-live="polite"
          aria-atomic="false"
        >
          {isEmpty ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No terms match{" "}
                <span className="font-medium text-foreground">
                  &ldquo;{query}&rdquo;
                </span>
                .
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className={cn(
                  "mt-2 text-xs text-primary underline-offset-4 hover:underline",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                )}
              >
                Clear search
              </button>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([cat, terms]) => (
              <section key={cat} aria-labelledby={`section-${cat}`}>
                <h2
                  id={`section-${cat}`}
                  className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70"
                >
                  {CATEGORY_LABELS[cat]}
                </h2>
                <ul className="space-y-3" role="list">
                  {terms.map((t) => (
                    <li key={t.id} role="listitem">
                      <TermCard
                        term={t}
                        onShowMe={
                          onHelpAction
                            ? (action) => {
                                setOpen(false)
                                queueMicrotask(() => onHelpAction(action))
                              }
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

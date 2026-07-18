/**
 * Educational help metadata for every analytics metric.
 * Consumed by HelpPopover and chart tooltips throughout the dashboard.
 *
 * Provider names are intentionally omitted from all user-facing text.
 * Internal implementation details (query logic, API routes) reference
 * PostHog only in server modules; this file is browser-safe.
 */
import type { MetricHelp } from "@/lib/analytics/types"

export const METRIC_HELP: Record<string, MetricHelp> = {
  visitors: {
    id: "visitors",
    label: "Visitors",
    glossaryTermId: "visitor",
    meaning:
      "The number of unique people who visited your site in the selected period. Each person is counted once no matter how many pages they viewed or how often they came back.",
    howCounted:
      "Ampere Sites tracks each visitor with a private, anonymous ID stored in their browser. If someone clears their cookies or uses a private browsing window, they may be counted again.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Visitor counts shift with your traffic sources, seasonality, and active promotions. Comparing to your own earlier period is almost always more useful than comparing to industry averages.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "See new and returning visitors by source",
        description:
          "Check which sources bring first-time visitors versus people who have been before.",
        widgetId: "new_returning_by_source",
      },
      {
        kind: "focus_widget",
        label: "See visitors over time",
        description:
          "See if high-traffic days line up with campaigns or content you published.",
        widgetId: "visitors_over_time",
      },
    ],
  },
  pageviews: {
    id: "pageviews",
    label: "Page views",
    glossaryTermId: "pageview",
    meaning:
      "The total number of individual pages loaded during the selected period. One visitor can create many page views by browsing multiple pages or refreshing.",
    howCounted:
      "Each time a tracked page loads or a route change is recorded in a single-page app, Ampere Sites logs one page view.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Page views and visitors often move together. A high page-views-to-visitors ratio can mean strong engagement (people exploring more content) or poor navigation (people struggling to find what they need).",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "See pages per visit",
        description:
          "See how many pages the average person reads per visit.",
        widgetId: "pages_per_session",
      },
      {
        kind: "focus_widget",
        label: "See your top pages",
        description:
          "If page views are flat while visitors grow, check whether people are going deeper into the site.",
        widgetId: "top_pages",
      },
    ],
  },
  bounce_rate: {
    id: "bounce_rate",
    label: "Bounce rate",
    glossaryTermId: "bounce_rate",
    meaning:
      "The percentage of visits where someone left after viewing only one page without any recorded interaction. A lower bounce rate generally means visitors are finding reasons to stay.",
    howCounted:
      "Ampere Sites counts a bounce when a visit ends with a single page view and no tracked interactions (clicks, scrolls, form actions) before the visitor leaves.",
    preference: "lower",
    referenceRange:
      "40 to 60 percent is typical for content sites. Landing pages and blogs often run 60 to 80 percent. If your goal is engagement, working toward below 40 percent is reasonable.",
    contextNotes:
      "Bounce rate depends heavily on traffic source and page type. Paid or social traffic often bounces more than organic search. A high bounce rate on a contact page is not necessarily a problem if people found what they needed and called.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "Review your top pages",
        description:
          "Check which pages get the most traffic, then filter to see bounce patterns.",
        widgetId: "top_pages",
      },
      {
        kind: "navigate",
        label: "Improve pages in the site editor",
        description:
          "Add a clear next step or call to action on high-bounce pages.",
        href: "/content",
      },
    ],
  },
  sessions: {
    id: "sessions",
    label: "Visits",
    glossaryTermId: "visit",
    meaning:
      "The total number of visits to your site in the selected period. One person can start multiple visits, usually separated by 30 minutes of inactivity.",
    howCounted:
      "Ampere Sites starts a new visit when more than 30 minutes pass between activity from the same visitor, or when a new browser session begins.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Visit counts are usually higher than unique visitors because some people return multiple times. A high visits-to-visitors ratio means your site is bringing people back.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "Compare visits to visitors",
        description: "See how often people return.",
        widgetId: "visitors",
      },
      {
        kind: "focus_widget",
        label: "Check conversion rate",
        description:
          "High visit counts with low conversions can mean people research but do not take the next step.",
        widgetId: "conversion_rate",
      },
    ],
  },
  new_vs_returning: {
    id: "new_vs_returning",
    label: "New vs returning",
    glossaryTermId: "new_vs_returning",
    meaning:
      "The split between first-time visitors and people who have been to your site before.",
    howCounted:
      "Ampere Sites checks whether a visitor has been seen before. A cleared cookie or a new device counts as a new visitor.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "High returning visitor rates suggest strong brand loyalty or a core audience. High new visitor rates suggest effective acquisition but potentially weak retention.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "See new and returning by source",
        description:
          "Find which sources bring first-time visitors versus repeat visitors.",
        widgetId: "new_returning_by_source",
      },
      {
        kind: "focus_widget",
        label: "Review how people found your site",
        description:
          "If new visitors are low, start with your acquisition sources.",
        widgetId: "traffic_sources",
      },
    ],
  },
  session_duration: {
    id: "session_duration",
    label: "Time per visit",
    glossaryTermId: "time_per_visit",
    meaning:
      "The average time visitors spend on your site per visit, measured from the first page they land on to the last action recorded.",
    howCounted:
      "Calculated from the first event to the last event in a visit. Visits with a single page and no follow-on activity have no measurable duration and are excluded from the average.",
    preference: "higher",
    referenceRange:
      "Two to four minutes is a common range for content sites. Service or product sites vary widely depending on what people are doing.",
    contextNotes:
      "Long visits can mean deep engagement or confusion. Short visits on a single-task page (like a contact form or a thank-you page) are completely normal.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "See your top pages",
        description:
          "Look at popular pages alongside traffic sources to see where people linger.",
        widgetId: "top_pages",
      },
      {
        kind: "open_filter",
        label: "Filter to a specific page",
        description:
          "Narrow the dashboard to one page to judge visit length in context.",
        dimension: "page",
      },
    ],
  },
  pages_per_session: {
    id: "pages_per_session",
    label: "Pages per visit",
    glossaryTermId: "pages_per_visit",
    meaning:
      "The average number of pages a visitor views during a single visit.",
    howCounted:
      "Total page views divided by total visits in the selected period.",
    preference: "higher",
    referenceRange:
      "Two to three pages per visit is typical. Content-heavy or documentation sites often run higher.",
    contextNotes:
      "High pages per visit is usually good, but it can occasionally mean people struggled to find what they wanted. Context matters.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "See where people leave",
        description:
          "Check which pages lead to continued browsing versus exits.",
        widgetId: "exit_pages",
      },
      {
        kind: "navigate",
        label: "Improve navigation in the site editor",
        description:
          "Stronger internal linking and clearer menus can raise this metric.",
        href: "/content",
      },
    ],
  },
  visitors_over_time: {
    id: "visitors_over_time",
    label: "Visitors over time",
    glossaryTermId: "visitor",
    meaning:
      "How your unique visitor count trends across your selected date range, broken into daily, weekly, or monthly buckets.",
    howCounted:
      "The same visitor is counted in each time bucket they appear. One person can appear in multiple daily buckets across a long period.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Seasonal patterns, publishing cadence, and campaign timing all shape this trend. Comparing to the prior period helps separate real growth from seasonal swings.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "Investigate traffic sources",
        description:
          "Note which days had spikes and see which sources drove them.",
        widgetId: "traffic_sources",
      },
      {
        kind: "open_glossary",
        label: "Learn about comparison periods",
        description:
          "A consistent upward trend is healthier than a single spike.",
        termId: "comparison_period",
      },
    ],
  },
  top_pages: {
    id: "top_pages",
    label: "Top pages",
    glossaryTermId: "pageview",
    meaning:
      "The pages on your site that received the most visits in the selected period, ranked by visitor count.",
    howCounted:
      "Each unique page path is counted by how many distinct visitors viewed it. Query strings and trailing slashes are normalized so similar URLs are grouped together.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Your homepage usually leads, but high-traffic interior pages can reveal what content is actually drawing people in from search or links on other sites.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a specific page",
        description:
          "Narrow the whole dashboard to visitors of one page.",
        dimension: "page",
      },
      {
        kind: "focus_widget",
        label: "Check conversion rate",
        description:
          "See whether your highest-traffic pages lead to the outcome you want.",
        widgetId: "conversion_rate",
      },
    ],
  },
  traffic_sources: {
    id: "traffic_sources",
    label: "How people found your site",
    glossaryTermId: "source",
    meaning:
      "Where your visitors came from before arriving, grouped by source (Google, Facebook, a referring website, or a direct visit).",
    howCounted:
      "Ampere Sites reads the referring address and any campaign labels present in the URL. Direct means no referring address was recorded, which includes some email links and most visits from messaging apps.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Source tracking is not perfect. Messages shared in apps like Slack or iMessage often show up as direct. Adding UTM campaign labels to your links gives the clearest picture of where traffic comes from.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a specific source",
        description: "Focus the dashboard on one traffic source.",
        dimension: "source",
      },
      {
        kind: "open_glossary",
        label: "Learn about campaign labels",
        description:
          "If direct traffic is very high, campaign labels on email and social links can clarify where visits come from.",
        termId: "utm_label",
      },
    ],
  },
  referrers: {
    id: "referrers",
    label: "Websites that sent visitors",
    glossaryTermId: "referring_website",
    meaning:
      "The specific websites that sent traffic your way, showing the domain of the page that linked to yours.",
    howCounted:
      "Read from the browser's referrer address. Links from HTTPS sites going to HTTP pages may not pass along the referrer.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Referrers show which external sites are actively sending visitors. Press coverage, directory listings, and partner sites often appear here.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a referring website",
        description:
          "Narrow the dashboard to visitors from one referring site.",
        dimension: "referrer",
      },
      {
        kind: "focus_widget",
        label: "Check bounce rate",
        description:
          "Compare engagement after filtering to a specific referrer.",
        widgetId: "bounce_rate",
      },
    ],
  },
  channels: {
    id: "channels",
    label: "Channels",
    glossaryTermId: "channel",
    meaning:
      "Traffic grouped into broader categories: organic search, paid search, social, email, referral, and direct.",
    howCounted:
      "Derived from campaign labels and the referrer address. Organic search is inferred from known search engine referrers. Channel groupings follow standard marketing conventions.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Channel views are a higher-level picture than individual referrers. They help you understand the mix of paid versus organic, and search versus social.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a channel",
        description: "Focus the dashboard on one channel category.",
        dimension: "channel",
      },
      {
        kind: "focus_widget",
        label: "Drill into individual sources",
        description:
          "See the specific sites and platforms inside each channel.",
        widgetId: "traffic_sources",
      },
    ],
  },
  countries: {
    id: "countries",
    label: "Countries",
    meaning:
      "A geographic breakdown of where your visitors are located, based on their approximate location.",
    howCounted:
      "Ampere Sites estimates location from the visitor's IP address. VPN users may appear in the wrong location.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Useful for understanding your audience geography, tailoring content, or refining ad targeting. May not reflect intent if you run broad reach campaigns.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a country",
        description: "See how visitors from one country behave.",
        dimension: "country",
      },
      {
        kind: "focus_widget",
        label: "See traffic sources",
        description:
          "Pair geography with sources to understand how people arrive.",
        widgetId: "traffic_sources",
      },
    ],
  },
  devices: {
    id: "devices",
    label: "Devices",
    meaning:
      "The device type each visitor used: desktop, mobile, or tablet.",
    howCounted:
      "Detected from the browser's user-agent string. Newer form factors like foldable phones may not categorize cleanly.",
    preference: "neutral",
    referenceRange:
      "Most sites see 50 to 70 percent mobile traffic. This varies by audience and industry.",
    contextNotes:
      "If your site is hard to use on mobile and mobile is your largest segment, that is a priority to address.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter by device type",
        description: "Compare desktop, mobile, and tablet side by side.",
        dimension: "device",
      },
      {
        kind: "focus_widget",
        label: "Compare bounce rate",
        description:
          "If mobile visitors bounce more, a mobile experience review is worth the time.",
        widgetId: "bounce_rate",
      },
    ],
  },
  browsers: {
    id: "browsers",
    label: "Browsers",
    meaning:
      "Which web browsers your visitors use: Chrome, Safari, Firefox, Edge, and others.",
    howCounted:
      "Detected from the user-agent string sent with each request.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Safari is dominant on iPhone and iPad. Chrome leads on desktop and Android. Knowing your browser split helps you prioritize compatibility testing.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter by browser",
        description:
          "Focus on browsers that make up more than a small share of traffic.",
        dimension: "browser",
      },
      {
        kind: "navigate",
        label: "Review pages in the site editor",
        description:
          "Check layouts and interactions on the browsers your audience actually uses.",
        href: "/content",
      },
    ],
  },
  operating_systems: {
    id: "operating_systems",
    label: "Operating systems",
    meaning:
      "The OS each visitor was using: Windows, macOS, iOS, Android, and others.",
    howCounted:
      "Detected from the user-agent string.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "OS data helps with platform-specific testing priorities and understanding your audience. iOS and Android together usually reflect your mobile share.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter by operating system",
        description:
          "If one OS shows a high bounce rate, investigate rendering or compatibility issues.",
        dimension: "os",
      },
      {
        kind: "focus_widget",
        label: "Check bounce rate",
        description:
          "Compare engagement after filtering to a specific OS.",
        widgetId: "bounce_rate",
      },
    ],
  },
  screen_sizes: {
    id: "screen_sizes",
    label: "Screen sizes",
    meaning:
      "The display resolutions your visitors use, grouped into common breakpoints.",
    howCounted:
      "Captured from the browser's screen dimensions at page load.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Useful for informing responsive design decisions. A large share of very narrow screens may mean your breakpoints need adjustment.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter by screen size",
        description:
          "Check layouts at the widths your visitors actually use.",
        dimension: "screen_size",
      },
      {
        kind: "navigate",
        label: "Review responsive layouts",
        description: "Open the site editor to adjust layouts and media.",
        href: "/content",
      },
    ],
  },
  active_visitors: {
    id: "active_visitors",
    label: "Active right now",
    meaning:
      "People currently on your site in approximately the last 5 minutes.",
    howCounted:
      "Ampere Sites counts visitors with a recent event in the live feed. The count refreshes every 30 seconds.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Live visitor counts are approximate. Very low-traffic sites may show zero for most of the day. Spikes often happen when a newsletter goes out, a social post picks up, or an ad campaign goes live.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "See live sources",
        description:
          "Watch where people are coming from when a campaign goes live.",
        widgetId: "live_sources",
      },
      {
        kind: "focus_widget",
        label: "See active pages",
        description:
          "Confirm people are landing on the pages you expect.",
        widgetId: "active_pages",
      },
    ],
  },
  active_pages: {
    id: "active_pages",
    label: "Active pages",
    meaning:
      "The pages being viewed right now, ranked by current active visitor count.",
    howCounted:
      "Pages with at least one visitor who has had recent activity in the last 5 minutes.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "This is a live snapshot. A single page dominating the list usually means a recent link or campaign is sending traffic directly there.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "Check live sources",
        description:
          "If an unexpected page is getting traffic, see where it came from.",
        widgetId: "live_sources",
      },
      {
        kind: "open_filter",
        label: "Filter to a page",
        description: "Narrow the dashboard to one active page.",
        dimension: "page",
      },
    ],
  },
  live_sources: {
    id: "live_sources",
    label: "Live sources",
    meaning:
      "Where the people currently on your site came from.",
    howCounted:
      "Referrer and campaign label data for active visits in the last 5 minutes.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Live source data is especially useful during campaigns to confirm traffic is coming from the intended channel.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a source",
        description:
          "Apply a source filter when unexpected live traffic shows up.",
        dimension: "source",
      },
      {
        kind: "focus_widget",
        label: "See how people found your site",
        description:
          "Compare the live snapshot with the longer-period source breakdown.",
        widgetId: "traffic_sources",
      },
    ],
  },
  entry_pages: {
    id: "entry_pages",
    label: "First pages people saw",
    glossaryTermId: "first_page",
    meaning:
      "The first pages visitors landed on when they arrived at your site.",
    howCounted:
      "The first page view recorded in each visit.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Entry pages often differ from your most viewed pages. A high-traffic entry page with a high bounce rate is a good candidate for improvement.",
    nextSteps: [
      {
        kind: "navigate",
        label: "Improve first-page content",
        description:
          "Make sure top entry pages have a clear next step for the visitor.",
        href: "/content",
      },
      {
        kind: "focus_widget",
        label: "Check bounce rate",
        description:
          "High bounce on a top entry page is a strong signal to revise that page.",
        widgetId: "bounce_rate",
      },
    ],
  },
  exit_pages: {
    id: "exit_pages",
    label: "Last pages people saw",
    glossaryTermId: "last_page",
    meaning:
      "The pages visitors were on when they left your site.",
    howCounted:
      "The last page view recorded in each visit.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Some exit pages are expected (contact confirmation, checkout complete). Others may indicate friction or dead ends worth investigating.",
    nextSteps: [
      {
        kind: "navigate",
        label: "Add clearer next steps",
        description:
          "Pages with high exit rates may need stronger calls to action or better internal links.",
        href: "/content",
      },
      {
        kind: "focus_widget",
        label: "Compare with top pages",
        description:
          "See whether high-exit pages are also high-traffic pages.",
        widgetId: "top_pages",
      },
    ],
  },
  goal_completions: {
    id: "goal_completions",
    label: "Goal completions",
    glossaryTermId: "conversion",
    meaning:
      "The number of times visitors completed a defined goal (a form submission, a button click, a purchase, and so on).",
    howCounted:
      "Each time a tracked goal event fires during the selected period.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Goals are only as useful as the actions you have set up to track. If this widget shows no data, goals may not be configured yet.",
    nextSteps: [
      {
        kind: "open_glossary",
        label: "Learn what conversions are",
        description:
          "Understand how goals relate to the outcomes you care about.",
        termId: "conversion",
      },
      {
        kind: "focus_widget",
        label: "See conversion rate",
        description:
          "Compare goal completions to visitors as a percentage.",
        widgetId: "conversion_rate",
      },
    ],
  },
  conversion_rate: {
    id: "conversion_rate",
    label: "Conversion rate",
    glossaryTermId: "conversion_rate",
    meaning:
      "The percentage of visitors who completed at least one goal during their visit.",
    howCounted:
      "Visitors who triggered a goal event divided by total visitors in the selected period.",
    preference: "higher",
    referenceRange:
      "Conversion rates vary widely by industry and goal type. E-commerce typically sees 1 to 3 percent. Lead generation forms run 3 to 5 percent on a strong landing page. Use your own prior period as the real benchmark.",
    contextNotes:
      "A high conversion rate with low total conversions may mean great targeting but limited reach. A low rate with high traffic may mean the offer or experience needs work.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter by traffic source",
        description: "Find your highest-converting channels.",
        dimension: "source",
      },
      {
        kind: "navigate",
        label: "Edit landing pages",
        description:
          "Try different copy or layout on pages meant to convert.",
        href: "/content",
      },
    ],
  },
  utm_source: {
    id: "utm_source",
    label: "Campaign source",
    glossaryTermId: "utm_label",
    meaning:
      "Traffic broken down by the campaign source label, which identifies the platform or site that sent the click.",
    howCounted:
      "Read from the utm_source parameter added to your links.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Campaign source is the top-level identifier in your campaign tracking. Combine with medium and campaign name for full attribution.",
    nextSteps: [
      {
        kind: "open_glossary",
        label: "Learn how campaign labels work",
        description:
          "Consistent naming keeps campaign data clean and comparable.",
        termId: "utm_label",
      },
      {
        kind: "focus_widget",
        label: "See campaign medium",
        description: "Look at the channel type next to the source.",
        widgetId: "utm_medium",
      },
    ],
  },
  utm_medium: {
    id: "utm_medium",
    label: "Campaign medium",
    glossaryTermId: "utm_label",
    meaning:
      "Traffic broken down by the campaign medium label, which identifies the marketing channel (email, paid search, social, and so on).",
    howCounted:
      "Read from the utm_medium parameter added to your links.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Medium groups your traffic by channel type. Consistent naming (always using 'email' rather than 'newsletter' or 'email-blast', for example) makes analysis much easier.",
    nextSteps: [
      {
        kind: "open_glossary",
        label: "Learn how campaign labels work",
        description:
          "Audit medium values for inconsistencies that split related data.",
        termId: "utm_label",
      },
      {
        kind: "focus_widget",
        label: "See campaign source",
        description: "Pair medium with the platform that sent the click.",
        widgetId: "utm_source",
      },
    ],
  },
  core_web_vitals: {
    id: "core_web_vitals",
    label: "Core Web Vitals",
    meaning:
      "Google's standardized measurements of real-world page experience: how fast it loads, how quickly it responds to clicks, and how stable the layout is.",
    howCounted:
      "Captured from real browser sessions as visitors use your site.",
    preference: "neutral",
    referenceRange:
      "Google defines 'good' as loading in under 2.5 seconds, responding to clicks in under 200ms, and keeping layout shifts below 0.1.",
    contextNotes:
      "Core Web Vitals affect both visitor experience and your position in Google search results. Scores vary by device and connection speed.",
    nextSteps: [
      {
        kind: "focus_widget",
        label: "Start with top pages",
        description:
          "Improve highest-traffic pages first for the biggest impact.",
        widgetId: "top_pages",
      },
      {
        kind: "navigate",
        label: "Review pages in the site editor",
        description:
          "Check heavy images, layout shifts, and slow sections on key pages.",
        href: "/content",
      },
    ],
  },
  new_returning_by_source: {
    id: "new_returning_by_source",
    label: "New and returning by source",
    glossaryTermId: "new_vs_returning",
    meaning:
      "Each way people found your site, with separate counts for first-time visitors and people who have been before.",
    howCounted:
      "Ampere Sites groups visitors by the source that brought them, then splits each source into new and returning based on whether the visit was in that person's first recorded session.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "A source that brings mostly new visitors is strong for growth. A source that brings mostly returning visitors may reflect loyalty, email lists, or people checking back for updates.",
    nextSteps: [
      {
        kind: "open_filter",
        label: "Filter to a source",
        description:
          "Narrow the dashboard to one source and compare the rest of your metrics.",
        dimension: "source",
      },
      {
        kind: "focus_widget",
        label: "See the overall new vs returning split",
        description:
          "Compare this breakdown with the site-wide new versus returning view.",
        widgetId: "new_vs_returning",
      },
    ],
  },
}

/** Help metadata keyed to the widget ID for widget-level headers and titles. */
export const WIDGET_TITLE_HELP: Partial<Record<string, string>> = {
  visitors: "visitors",
  pageviews: "pageviews",
  bounce_rate: "bounce_rate",
  sessions: "sessions",
  visitors_over_time: "visitors_over_time",
  top_pages: "top_pages",
  traffic_sources: "traffic_sources",
  referrers: "referrers",
  channels: "channels",
  countries: "countries",
  devices: "devices",
  browsers: "browsers",
  operating_systems: "operating_systems",
  screen_sizes: "screen_sizes",
  active_visitors: "active_visitors",
  active_pages: "active_pages",
  live_sources: "live_sources",
  entry_pages: "entry_pages",
  exit_pages: "exit_pages",
  goal_completions: "goal_completions",
  conversion_rate: "conversion_rate",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  core_web_vitals: "core_web_vitals",
  new_returning_by_source: "new_returning_by_source",
  new_vs_returning: "new_vs_returning",
  session_duration: "session_duration",
  pages_per_session: "pages_per_session",
}

/**
 * Human-readable titles for each widget ID used in headers, skeletons,
 * the widget catalog, and filter rail. Labels are written for first-time
 * users and do not reference internal system names.
 */
export const WIDGET_TITLES: Record<string, string> = {
  visitors: "Visitors",
  pageviews: "Page views",
  bounce_rate: "Bounce rate",
  sessions: "Visits",
  new_vs_returning: "New vs returning",
  session_duration: "Time per visit",
  pages_per_session: "Pages per visit",
  engaged_visits: "Engaged visits",
  visit_frequency: "Visit frequency",
  retention: "Retention",
  time_of_day: "Time of day",
  day_of_week: "Day of week",
  visitors_over_time: "Visitors over time",
  top_pages: "Top pages",
  entry_pages: "First pages people saw",
  exit_pages: "Last pages people saw",
  time_on_page: "Time on page",
  scroll_depth: "Scroll depth",
  outbound_links: "Outbound links",
  downloads: "Downloads",
  site_search: "Site search",
  page_paths: "Page paths",
  page_transitions: "Page transitions",
  traffic_sources: "How people found your site",
  referrers: "Websites that sent visitors",
  channels: "Channels",
  utm_source: "Campaign source",
  utm_medium: "Campaign medium",
  utm_campaign: "Campaign name",
  utm_content: "Campaign content",
  utm_term: "Campaign keyword",
  campaigns: "Campaigns",
  landing_pages_by_source: "Landing pages by source",
  new_returning_by_source: "New and returning by source",
  paid_vs_organic: "Paid vs organic",
  countries: "Countries",
  regions: "Regions",
  cities: "Cities",
  timezones: "Timezones",
  languages: "Languages",
  geo_map: "Geographic map",
  devices: "Devices",
  browsers: "Browsers",
  browser_versions: "Browser versions",
  operating_systems: "Operating systems",
  os_versions: "OS versions",
  screen_sizes: "Screen sizes",
  goal_completions: "Goal completions",
  conversion_rate: "Conversion rate",
  conversion_trend: "Conversion trend",
  funnels: "Funnels",
  form_submissions: "Form submissions",
  revenue: "Revenue",
  custom_events: "Custom events",
  core_web_vitals: "Core Web Vitals",
  slow_pages: "Slow pages",
  errors_404: "404 errors",
  active_visitors: "Active right now",
  active_pages: "Active pages",
  live_sources: "Live sources",
}

/**
 * Context-specific name-column labels for ranked tables.
 * Falls back to a generic label when a widget is not listed.
 */
export const WIDGET_TABLE_NAME_LABELS: Partial<Record<string, string>> = {
  top_pages: "Page",
  entry_pages: "First page",
  exit_pages: "Last page",
  traffic_sources: "Source",
  referrers: "Website",
  channels: "Channel",
  countries: "Country",
  regions: "Region",
  cities: "City",
  devices: "Device",
  browsers: "Browser",
  operating_systems: "Operating system",
  screen_sizes: "Screen size",
  languages: "Language",
  utm_source: "Campaign source",
  utm_medium: "Campaign medium",
  utm_campaign: "Campaign name",
  utm_content: "Campaign content",
  utm_term: "Campaign keyword",
  active_pages: "Page",
  live_sources: "Source",
  new_returning_by_source: "Source",
}

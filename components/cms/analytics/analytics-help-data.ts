/**
 * Educational help metadata for every analytics metric.
 * Consumed by HelpPopover and chart tooltips throughout the dashboard.
 */
import type { MetricHelp } from "@/lib/analytics/types"

export const METRIC_HELP: Record<string, MetricHelp> = {
  visitors: {
    id: "visitors",
    label: "Visitors",
    meaning:
      "The number of unique people who visited your site in the selected period. Each person is counted once, regardless of how many pages they viewed or how often they returned.",
    howCounted:
      "PostHog identifies visitors by a persistent anonymous ID stored in the browser. Clearing cookies or using private browsing may cause a person to be counted again.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Visitor counts vary widely by traffic source quality, seasonality, and whether you are running active promotions. Comparing to your own prior periods gives a more useful signal than industry averages.",
    nextSteps: [
      "Check which sources are driving new visitors vs returning ones.",
      "See if high-traffic days line up with campaigns or content you published.",
    ],
  },
  pageviews: {
    id: "pageviews",
    label: "Pageviews",
    meaning:
      "The total number of individual page loads in the selected period. One visitor can generate many pageviews by browsing multiple pages or reloading.",
    howCounted:
      "Each time a tracked page loads or a route change is recorded in a single-page app, PostHog logs one pageview event.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Pageviews and visitors often move together. A high pageviews-to-visitors ratio can signal strong engagement (people exploring more content) or poor navigation (people struggling to find what they need).",
    nextSteps: [
      "Divide pageviews by visitors to get pages per visit.",
      "If pageviews are flat while visitors are growing, your content may not be drawing people deeper.",
    ],
  },
  bounce_rate: {
    id: "bounce_rate",
    label: "Bounce rate",
    meaning:
      "The percentage of visits where someone left after viewing only one page without any recorded interaction. A lower bounce rate generally means visitors are finding reasons to stay.",
    howCounted:
      "PostHog counts a bounce when a session ends with a single pageview and no tracked events (clicks, scrolls, form interactions) before the visitor leaves.",
    preference: "lower",
    referenceRange:
      "40 to 60 percent is typical for content sites. Landing pages and blogs often run 60 to 80 percent. If your goal is engagement, aiming below 40 percent is worth working toward.",
    contextNotes:
      "Bounce rate depends heavily on traffic source and page type. Paid or social traffic often bounces more than organic search. A high bounce rate on a contact page is not necessarily a problem if people found what they needed and called.",
    nextSteps: [
      "Check which pages or sources have the highest bounce rates to see if content matches visitor expectations.",
      "Adding a clear next step or call to action on high-bounce pages can help people move forward.",
    ],
  },
  sessions: {
    id: "sessions",
    label: "Sessions",
    meaning:
      "The total number of visits in the selected period. One visitor can start multiple sessions, typically separated by 30 minutes of inactivity or a new browser window.",
    howCounted:
      "PostHog starts a new session when more than 30 minutes pass between events from the same visitor, or when a new browser session begins.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Sessions usually exceed unique visitors because some people return multiple times. A high sessions-to-visitors ratio means your site brings people back.",
    nextSteps: [
      "Compare sessions to visitors to understand how often people return.",
      "High session counts with low conversions may mean the site is useful for research but not closing.",
    ],
  },
  new_vs_returning: {
    id: "new_vs_returning",
    label: "New vs returning",
    meaning:
      "The split between first-time visitors and people who have been to your site before.",
    howCounted:
      "PostHog checks whether a visitor ID has been seen before in the current project. A cleared cookie or new device counts as a new visitor.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "High returning visitor rates can mean strong brand loyalty or a core user base. High new visitor rates can mean effective acquisition but potentially weak retention.",
    nextSteps: [
      "If returning visitors are low, consider whether your content or product gives people a reason to come back.",
      "If new visitors are low, review your acquisition channels and SEO coverage.",
    ],
  },
  session_duration: {
    id: "session_duration",
    label: "Session duration",
    meaning:
      "The average time visitors spend on your site per visit, measured from the first pageview to the last tracked event.",
    howCounted:
      "Calculated from the timestamp of the first event to the last event in a session. Single-page sessions with no follow-on events have no measurable duration and are excluded from the average.",
    preference: "higher",
    referenceRange:
      "Two to four minutes is a common range for content sites. Service or SaaS products vary widely depending on task complexity.",
    contextNotes:
      "Long sessions can mean deep engagement or confusion. Short sessions on a single-task page (like a login or thank-you page) are completely normal.",
    nextSteps: [
      "Look at session duration by page and traffic source together.",
      "Pages with very short sessions might benefit from clearer content or better next steps.",
    ],
  },
  pages_per_session: {
    id: "pages_per_session",
    label: "Pages per session",
    meaning:
      "The average number of pages a visitor views during a single visit.",
    howCounted:
      "Total pageviews divided by total sessions in the selected period.",
    preference: "higher",
    referenceRange:
      "Two to three pages per session is typical. Content-heavy or documentation sites often run higher.",
    contextNotes:
      "High pages per session is usually good, but can occasionally mean people struggled to find what they wanted. Context matters.",
    nextSteps: [
      "Check which pages lead to continued browsing vs exits.",
      "Strong internal linking and clear navigation can raise this metric.",
    ],
  },
  visitors_over_time: {
    id: "visitors_over_time",
    label: "Visitors over time",
    meaning:
      "How unique visitor counts trend across your selected date range, broken into daily, weekly, or monthly buckets.",
    howCounted:
      "The same visitor is counted each bucket they appear in. Because this is a trend view, one person can appear in multiple daily buckets across a long period.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Seasonal patterns, publishing cadence, and campaign timing all shape this trend. Comparing to the prior period helps separate genuine growth from seasonal variation.",
    nextSteps: [
      "Note which days or weeks had spikes and investigate what drove them.",
      "A consistent upward trend is a healthier signal than a single viral spike.",
    ],
  },
  top_pages: {
    id: "top_pages",
    label: "Top pages",
    meaning:
      "The pages on your site that received the most visits in the selected period, ranked by visitor count.",
    howCounted:
      "Each unique page path is tallied by how many distinct visitors viewed it during the period. Query strings and trailing slashes are normalized.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Your homepage usually leads, but high-traffic interior pages can reveal what content is actually drawing people in from search or referrals.",
    nextSteps: [
      "Click any page row to filter the whole dashboard to just visitors of that page.",
      "Check whether your highest-traffic pages are converting visitors to the outcome you want.",
    ],
  },
  traffic_sources: {
    id: "traffic_sources",
    label: "Traffic sources",
    meaning:
      "Where your visitors came from before arriving, grouped by source (Google, Facebook, direct, and so on).",
    howCounted:
      "PostHog reads the HTTP referrer header and UTM parameters. Direct means no referrer was recorded, which includes some email links and secure-to-HTTP transitions.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Source attribution is not perfect. Dark social (Slack, messaging apps) often appears as direct. UTM-tagged links give the clearest source information for campaigns.",
    nextSteps: [
      "Click any source row to filter the dashboard to that traffic only.",
      "If direct traffic is very high, consider whether your email or social campaigns use UTM parameters.",
    ],
  },
  referrers: {
    id: "referrers",
    label: "Referrers",
    meaning:
      "The specific websites that sent traffic your way, showing the domain of the page that linked to yours.",
    howCounted:
      "Read from the HTTP referrer header. Transitions from HTTPS sites to HTTP may lose the referrer.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Referrers show which external sites are actively sending visitors. Press coverage, directory listings, and partner sites often show up here.",
    nextSteps: [
      "Identify which referring sites bring engaged visitors vs high-bounce ones.",
      "Building relationships with high-quality referrers can become a scalable traffic source.",
    ],
  },
  channels: {
    id: "channels",
    label: "Channels",
    meaning:
      "Traffic grouped into broader categories: organic search, paid search, social, email, referral, and direct.",
    howCounted:
      "Derived from UTM parameters and referrer data. Organic search is inferred from known search engine referrers. Channel groupings follow standard marketing conventions.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Channel views are a higher-level view than referrers. They help you understand the mix of paid vs organic, search vs social.",
    nextSteps: [
      "A healthy channel mix reduces your dependency on any single source.",
      "If one channel dominates, consider whether the others are underinvested or the dominant one is genuinely the best fit.",
    ],
  },
  countries: {
    id: "countries",
    label: "Countries",
    meaning:
      "A geographic breakdown of where your visitors are located, based on IP address geolocation.",
    howCounted:
      "PostHog resolves visitor IP addresses to country using a geolocation database. VPN users may appear in the wrong location.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Useful for understanding your audience geography, tailoring content, or refining ad targeting. May not reflect intent if you run broad reach campaigns.",
    nextSteps: [
      "If significant traffic comes from outside your service area, review your ad targeting or page metadata.",
      "High traffic from a specific country can be a signal to create localized content.",
    ],
  },
  devices: {
    id: "devices",
    label: "Devices",
    meaning:
      "The device type each visitor used: desktop, mobile, or tablet.",
    howCounted:
      "Parsed from the browser user agent string. Newer form factors like foldable phones may not categorize cleanly.",
    preference: "neutral",
    referenceRange:
      "Most sites see 50 to 70 percent mobile traffic. Varies by audience.",
    contextNotes:
      "If your site is hard to use on mobile and mobile is your largest segment, that is a priority to address.",
    nextSteps: [
      "Compare bounce rate and conversion rate between device types.",
      "If mobile visitors bounce significantly more, a mobile UX audit is worth the time.",
    ],
  },
  browsers: {
    id: "browsers",
    label: "Browsers",
    meaning:
      "Which web browsers your visitors use: Chrome, Safari, Firefox, Edge, and others.",
    howCounted:
      "Parsed from the user agent string sent with each request.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Safari is dominant on iOS. Chrome leads on desktop and Android. Knowing your browser split helps you prioritize cross-browser testing.",
    nextSteps: [
      "Focus QA testing on browsers that make up more than 5 percent of your traffic.",
      "If you see a spike in a new browser version, check for any compatibility issues.",
    ],
  },
  operating_systems: {
    id: "operating_systems",
    label: "Operating systems",
    meaning:
      "The OS each visitor was using: Windows, macOS, iOS, Android, and others.",
    howCounted:
      "Parsed from the user agent string.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "OS data helps with platform-specific bug prioritization and understanding your audience. iOS and Android together usually reflect mobile share.",
    nextSteps: [
      "If one OS shows a disproportionately high bounce rate, investigate for rendering or compatibility issues.",
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
      "Check your layouts at the most common screen widths your visitors actually use.",
    ],
  },
  active_visitors: {
    id: "active_visitors",
    label: "Active right now",
    meaning:
      "People currently on your site in approximately the last 5 minutes.",
    howCounted:
      "PostHog counts visitors with a recent event in the live feed. The count refreshes every 30 seconds.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Live visitor counts are approximate. Very low-traffic sites may show zero for most of the day. Spikes often correlate with newsletter sends, social posts, or ad campaigns going live.",
    nextSteps: [
      "Watch for live spikes when you publish or send a campaign to see real-time impact.",
      "Persistent high counts may signal a piece of content getting attention worth following up on.",
    ],
  },
  active_pages: {
    id: "active_pages",
    label: "Active pages",
    meaning:
      "The pages being viewed right now, ranked by current active visitor count.",
    howCounted:
      "Pages with at least one visitor who has had a recent event in the PostHog live feed.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "This is a live snapshot. A single page dominating the list usually means a recent link or campaign is sending traffic directly there.",
    nextSteps: [
      "If an unexpected page is getting live traffic, investigate the source.",
      "Use active pages to confirm a just-launched campaign is landing where you expect.",
    ],
  },
  live_sources: {
    id: "live_sources",
    label: "Live sources",
    meaning:
      "Where the people currently on your site came from.",
    howCounted:
      "Referrer and UTM data for active sessions in the last 5 minutes.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Live source data is especially useful during campaigns to confirm traffic is coming from the intended channel.",
    nextSteps: [
      "If a source you did not expect is dominating live traffic, investigate quickly.",
    ],
  },
  entry_pages: {
    id: "entry_pages",
    label: "Entry pages",
    meaning:
      "The first pages visitors landed on when they arrived at your site.",
    howCounted:
      "The first pageview in each session.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Entry pages often differ from your most viewed pages. A high-entry page with a high bounce rate is a candidate for improvement.",
    nextSteps: [
      "Make sure your top entry pages have a clear next step for the visitor.",
    ],
  },
  exit_pages: {
    id: "exit_pages",
    label: "Exit pages",
    meaning:
      "The pages visitors were on when they left your site.",
    howCounted:
      "The last pageview in each session.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Some exit pages are expected (contact confirmation, checkout complete). Others may indicate friction or dead ends worth investigating.",
    nextSteps: [
      "Pages with unexpectedly high exit rates may benefit from stronger calls to action or better internal linking.",
    ],
  },
  goal_completions: {
    id: "goal_completions",
    label: "Goal completions",
    meaning:
      "The number of times visitors completed a defined goal (a form submission, a button click, a purchase, etc.).",
    howCounted:
      "Each time a tracked goal event fires in PostHog during the selected period.",
    preference: "higher",
    referenceRange: null,
    contextNotes:
      "Goals are only as useful as the events you have configured. If this widget shows no data, goals may not be set up yet.",
    nextSteps: [
      "Define goals for your most important user actions in PostHog.",
      "Compare goal completions to visitors to get a conversion rate.",
    ],
  },
  conversion_rate: {
    id: "conversion_rate",
    label: "Conversion rate",
    meaning:
      "The percentage of visitors who completed at least one goal during their visit.",
    howCounted:
      "Visitors who triggered a goal event divided by total visitors in the selected period.",
    preference: "higher",
    referenceRange:
      "Conversion rates vary hugely by industry and goal type. E-commerce typically sees 1 to 3 percent. Lead generation forms run 3 to 5 percent on a good landing page. Use your own prior period as the benchmark.",
    contextNotes:
      "A high conversion rate with low total conversions may mean great targeting but limited reach. A low rate with high traffic may mean the offer or experience needs work.",
    nextSteps: [
      "Segment conversion rate by traffic source to find your highest-performing channels.",
      "A/B testing landing page copy or layout can surface meaningful conversion lifts.",
    ],
  },
  utm_source: {
    id: "utm_source",
    label: "UTM source",
    meaning:
      "Traffic broken down by the utm_source parameter, identifying the platform or site that sent the click.",
    howCounted:
      "Read from the utm_source query parameter present in the landing URL.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "UTM source is the top-level identifier in your campaign tracking. Combine with utm_medium and utm_campaign for full attribution.",
    nextSteps: [
      "Standardize your UTM naming conventions across campaigns so the data stays clean.",
    ],
  },
  utm_medium: {
    id: "utm_medium",
    label: "UTM medium",
    meaning:
      "Traffic broken down by the utm_medium parameter, identifying the marketing channel (email, cpc, social, etc.).",
    howCounted:
      "Read from the utm_medium query parameter.",
    preference: "neutral",
    referenceRange: null,
    contextNotes:
      "Medium groups your traffic by channel type. Consistent medium naming (for example always using 'email' rather than 'newsletter' or 'email-blast') makes analysis much easier.",
    nextSteps: [
      "Audit your UTM medium values to find inconsistencies that may be splitting data you want to see together.",
    ],
  },
  core_web_vitals: {
    id: "core_web_vitals",
    label: "Core Web Vitals",
    meaning:
      "Google's standardized measurements of real-world page experience: LCP (loading), INP (interactivity), and CLS (visual stability).",
    howCounted:
      "Captured by the PostHog web performance integration from real browser sessions.",
    preference: "neutral",
    referenceRange:
      "Google defines 'good' as LCP under 2.5 seconds, INP under 200ms, and CLS under 0.1.",
    contextNotes:
      "Core Web Vitals affect both user experience and Google search ranking. Scores vary by device and connection speed.",
    nextSteps: [
      "Focus first on your highest-traffic pages where improvements will have the most impact.",
      "Use Chrome DevTools or Google Search Console for deeper performance debugging.",
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
}

/** Human-readable titles for each widget ID used in headers and skeleton state. */
export const WIDGET_TITLES: Record<string, string> = {
  visitors: "Visitors",
  pageviews: "Pageviews",
  bounce_rate: "Bounce rate",
  sessions: "Sessions",
  new_vs_returning: "New vs returning",
  session_duration: "Session duration",
  pages_per_session: "Pages per session",
  engaged_visits: "Engaged visits",
  visit_frequency: "Visit frequency",
  retention: "Retention",
  time_of_day: "Time of day",
  day_of_week: "Day of week",
  visitors_over_time: "Visitors over time",
  top_pages: "Top pages",
  entry_pages: "Entry pages",
  exit_pages: "Exit pages",
  time_on_page: "Time on page",
  scroll_depth: "Scroll depth",
  outbound_links: "Outbound links",
  downloads: "Downloads",
  site_search: "Site search",
  page_paths: "Page paths",
  page_transitions: "Page transitions",
  traffic_sources: "Traffic sources",
  referrers: "Referrers",
  channels: "Channels",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "UTM campaign",
  utm_content: "UTM content",
  utm_term: "UTM term",
  campaigns: "Campaigns",
  landing_pages_by_source: "Landing pages by source",
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

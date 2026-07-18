/**
 * Sanitize analytics strings before they reach the browser.
 * Provider names and credential-shaped substrings stay out of UI copy.
 */

export function userFacingAnalyticsMessage(message: string): string {
  return message
    .replace(/phx_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/\bPostHog\b/gi, "Ampere Sites")
    .replace(/\s{2,}/g, " ")
    .trim()
}

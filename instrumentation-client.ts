import posthog from "posthog-js"

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

function isLocalhostHostname() {
  if (typeof window === "undefined") return false
  const hostname = window.location.hostname
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  )
}

if (token && !isLocalhostHostname()) {
  posthog.init(token, {
    api_host: host || "https://us.i.posthog.com",
    defaults: "2026-05-30",
    capture_pageview: true,
    capture_pageleave: true,
    // Record every production session.
    disable_session_recording: false,
    session_recording: {
      // No minimum duration — capture bounce traffic too.
      strictMinimumDuration: false,
    },
  })
}

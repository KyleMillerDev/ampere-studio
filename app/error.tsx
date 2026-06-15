"use client"

import { useEffect } from "react"
import { ErrorPage } from "@/components/error-page"

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorPage
      errorCode="500"
      title="Something went wrong"
      description="We ran into a problem loading this page. It is often temporary. Try again, or use the links below to keep browsing."
      onRetry={reset}
    />
  )
}

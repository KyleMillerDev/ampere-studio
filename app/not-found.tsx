import type { Metadata } from "next"
import { ErrorPage } from "@/components/error-page"

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "That page is not on our site. Use the links below to find what you need.",
}

export default function NotFound() {
  return (
    <ErrorPage
      errorCode="404"
      title="We could not find that page"
      description="The address may be wrong, or the page may have been moved or removed. Choose a link below or start from the home page."
    />
  )
}

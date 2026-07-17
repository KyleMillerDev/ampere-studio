import { redirect } from "next/navigation"

export const metadata = { title: "Sales overview" }

/** Sales overview now lives on the main dashboard for Stripe clients. */
export default function SalesOverviewPage() {
  redirect("/dashboard")
}

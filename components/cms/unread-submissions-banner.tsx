import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface UnreadSubmissionsBannerProps {
  count: number
}

export function UnreadSubmissionsBanner({
  count,
}: UnreadSubmissionsBannerProps) {
  if (count <= 0) return null

  const label =
    count === 1
      ? "You have 1 unread form submission"
      : `You have ${count > 99 ? "99+" : count} unread form submissions`

  return (
    <Link
      href="/submissions"
      className="flex shrink-0 items-center justify-between gap-3 bg-primary px-4 py-1 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <span className="font-medium">{label}</span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium">
        View submissions
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </span>
    </Link>
  )
}

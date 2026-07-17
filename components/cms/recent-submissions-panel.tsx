"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  isUnreadSubmission,
  type Submission,
  type SubmissionStatus,
} from "@/lib/cms/submission-types"
import { cn, formatRelativeTime, truncate } from "@/lib/utils"

const MESSAGE_PREVIEW_LENGTH = 72

interface RecentSubmissionsPanelProps {
  submissions: Submission[]
  className?: string
}

function submissionKey(submission: Submission): string {
  return `${submission.submissionId}:${submission.timestamp}`
}

function submissionHref(submission: Submission): string {
  const params = new URLSearchParams({
    submissionId: submission.submissionId,
    timestamp: submission.timestamp,
  })
  return `/submissions?${params.toString()}`
}

async function patchSubmissionStatus(
  items: Array<{ submissionId: string; timestamp: string }>,
  status: SubmissionStatus
): Promise<void> {
  const res = await fetch("/api/submissions/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, items }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Failed to update submissions"
    )
  }
}

async function deleteSubmissionsRequest(
  items: Array<{ submissionId: string; timestamp: string }>
): Promise<void> {
  const res = await fetch("/api/submissions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Failed to delete submissions"
    )
  }
}

export function RecentSubmissionsPanel({
  submissions: initialSubmissions,
  className,
}: RecentSubmissionsPanelProps) {
  const router = useRouter()
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [updating, setUpdating] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Submission | null>(null)

  useEffect(() => {
    setSubmissions(initialSubmissions)
  }, [initialSubmissions])

  async function applyStatus(submission: Submission, status: SubmissionStatus) {
    setUpdating(true)
    try {
      await patchSubmissionStatus(
        [
          {
            submissionId: submission.submissionId,
            timestamp: submission.timestamp,
          },
        ],
        status
      )
      const key = submissionKey(submission)
      setSubmissions((current) =>
        current.map((item) =>
          submissionKey(item) === key ? { ...item, status } : item
        )
      )
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update submission"
      )
    } finally {
      setUpdating(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return

    setUpdating(true)
    try {
      await deleteSubmissionsRequest([
        {
          submissionId: pendingDelete.submissionId,
          timestamp: pendingDelete.timestamp,
        },
      ])
      const key = submissionKey(pendingDelete)
      setSubmissions((current) =>
        current.filter((item) => submissionKey(item) !== key)
      )
      setDeleteConfirmOpen(false)
      setPendingDelete(null)
      toast.success("Submission deleted.")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete submission"
      )
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <aside
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Recent submissions
          </h2>
          <Link
            href="/submissions"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </Link>
        </div>

        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No form submissions yet.
          </p>
        ) : (
          <ul className="divide-y">
            {submissions.map((submission) => {
              const unread = isUnreadSubmission(submission.status)
              const message =
                submission.message?.trim() ||
                submission.serviceName ||
                submission.formId ||
                "No message included"

              return (
                <li key={submissionKey(submission)}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <Link
                        href={submissionHref(submission)}
                        className={cn(
                          "block px-4 py-3 transition-colors hover:bg-muted/50",
                          unread && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {submission.name?.trim() || "Anonymous"}
                          </p>
                          {unread ? (
                            <Badge
                              variant="default"
                              className="shrink-0 text-[10px]"
                            >
                              new
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatRelativeTime(submission.timestamp)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {truncate(message, MESSAGE_PREVIEW_LENGTH)}
                        </p>
                      </Link>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem
                        disabled={updating || !unread}
                        onSelect={() => void applyStatus(submission, "read")}
                      >
                        Mark as read
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={updating || unread}
                        onSelect={() => void applyStatus(submission, "new")}
                      >
                        Mark as unread
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        disabled={updating}
                        onSelect={() => {
                          setPendingDelete(submission)
                          setDeleteConfirmOpen(true)
                        }}
                      >
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open)
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the submission from{" "}
              {pendingDelete?.name?.trim() || "Anonymous"}
              {pendingDelete?.email ? ` (${pendingDelete.email})` : ""}. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              disabled={updating || !pendingDelete}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {updating ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

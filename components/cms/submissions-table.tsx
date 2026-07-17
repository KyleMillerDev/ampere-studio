"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"

import { TablePagination } from "@/components/cms/table-pagination"

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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  isUnreadSubmission,
  type Submission,
  type SubmissionStatus,
} from "@/lib/cms/submission-types"
import { formatDate, cn } from "@/lib/utils"

const PAGE_SIZE = 15

type SubmissionRow = Submission

function submissionKey(submission: SubmissionRow): string {
  return `${submission.submissionId}:${submission.timestamp}`
}

function buildReplyMailto(submission: SubmissionRow): string | null {
  if (!submission.email) return null

  const subjectParts = [
    submission.formId ? `Re: ${submission.formId} inquiry` : "Re: Your inquiry",
  ]
  if (submission.name) {
    subjectParts[0] = `Re: Message from ${submission.name}`
  }

  const bodyLines = [
    submission.name ? `Hi ${submission.name},` : "Hi,",
    "",
    "",
    "---",
    "Original message:",
    submission.message ?? "(No message provided)",
  ]

  const params = new URLSearchParams({
    subject: subjectParts[0] ?? "Re: Your inquiry",
    body: bodyLines.join("\n"),
  })

  return `mailto:${submission.email}?${params.toString()}`
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

interface SubmissionsTableProps {
  initialSubmissions: SubmissionRow[]
  focusSubmissionId?: string
  focusTimestamp?: string
}

export function SubmissionsTable({
  initialSubmissions,
  focusSubmissionId,
  focusTimestamp,
}: SubmissionsTableProps) {
  const router = useRouter()
  const focusHandledRef = useRef(false)
  const pendingScrollKeyRef = useRef<string | null>(null)
  const [submissions, setSubmissions] =
    useState<SubmissionRow[]>(initialSubmissions)
  const [page, setPage] = useState(1)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDeleteItems, setPendingDeleteItems] = useState<
    SubmissionRow[] | null
  >(null)

  useEffect(() => {
    setSubmissions(initialSubmissions)
  }, [initialSubmissions])

  const pageCount = Math.max(1, Math.ceil(submissions.length / PAGE_SIZE))

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, pageCount])

  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return submissions.slice(start, start + PAGE_SIZE)
  }, [page, submissions])

  const pageKeys = useMemo(
    () => paginatedSubmissions.map((submission) => submissionKey(submission)),
    [paginatedSubmissions]
  )

  const allPageSelected =
    pageKeys.length > 0 && pageKeys.every((key) => selectedKeys.has(key))
  const somePageSelected =
    pageKeys.some((key) => selectedKeys.has(key)) && !allPageSelected

  async function applyStatus(
    items: SubmissionRow[],
    status: SubmissionStatus,
    options?: { refreshSidebar?: boolean }
  ) {
    if (items.length === 0) return

    setUpdating(true)
    try {
      await patchSubmissionStatus(
        items.map((item) => ({
          submissionId: item.submissionId,
          timestamp: item.timestamp,
        })),
        status
      )

      const itemKeys = new Set(items.map((item) => submissionKey(item)))
      setSubmissions((current) =>
        current.map((item) =>
          itemKeys.has(submissionKey(item)) ? { ...item, status } : item
        )
      )

      if (options?.refreshSidebar !== false) {
        router.refresh()
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update submissions"
      )
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    if (focusHandledRef.current) return
    if (!focusSubmissionId || !focusTimestamp) return

    const key = `${focusSubmissionId}:${focusTimestamp}`
    const index = submissions.findIndex(
      (submission) => submissionKey(submission) === key
    )
    if (index === -1) return

    focusHandledRef.current = true
    const targetPage = Math.floor(index / PAGE_SIZE) + 1
    const submission = submissions[index]

    pendingScrollKeyRef.current = key
    setPage(targetPage)
    setExpandedKeys(new Set([key]))
    router.replace("/submissions", { scroll: false })

    if (isUnreadSubmission(submission.status)) {
      void applyStatus([submission], "read")
    }
    // Intentionally run once when focus params + submissions are available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSubmissionId, focusTimestamp, submissions])

  useEffect(() => {
    const key = pendingScrollKeyRef.current
    if (!key || !expandedKeys.has(key)) return

    const onPage = paginatedSubmissions.some(
      (submission) => submissionKey(submission) === key
    )
    if (!onPage) return

    pendingScrollKeyRef.current = null
    requestAnimationFrame(() => {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>("[data-submission-key]")
      ).find((element) => element.dataset.submissionKey === key)
      row?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [page, expandedKeys, paginatedSubmissions])

  async function toggleExpanded(submission: SubmissionRow) {
    const key = submissionKey(submission)
    const isExpanded = expandedKeys.has(key)

    setExpandedKeys((current) => {
      const next = new Set(current)
      if (isExpanded) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

    if (!isExpanded && isUnreadSubmission(submission.status)) {
      await applyStatus([submission], "read")
    }
  }

  function toggleSelected(key: string, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current)
      for (const key of pageKeys) {
        if (checked) {
          next.add(key)
        } else {
          next.delete(key)
        }
      }
      return next
    })
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
    setExpandedKeys(new Set())
  }

  async function bulkMark(status: SubmissionStatus) {
    const items = submissions.filter((submission) =>
      selectedKeys.has(submissionKey(submission))
    )
    await applyStatus(items, status)
    setSelectedKeys(new Set())
  }

  function requestDelete(items: SubmissionRow[]) {
    if (items.length === 0) return
    setPendingDeleteItems(items)
    setDeleteConfirmOpen(true)
  }

  async function confirmDelete() {
    const items = pendingDeleteItems
    if (!items || items.length === 0) return

    setUpdating(true)
    try {
      await deleteSubmissionsRequest(
        items.map((item) => ({
          submissionId: item.submissionId,
          timestamp: item.timestamp,
        }))
      )

      const itemKeys = new Set(items.map((item) => submissionKey(item)))
      setSubmissions((current) =>
        current.filter((item) => !itemKeys.has(submissionKey(item)))
      )
      setSelectedKeys((current) => {
        const next = new Set(current)
        for (const key of itemKeys) next.delete(key)
        return next
      })
      setExpandedKeys((current) => {
        const next = new Set(current)
        for (const key of itemKeys) next.delete(key)
        return next
      })
      setDeleteConfirmOpen(false)
      setPendingDeleteItems(null)
      toast.success(
        items.length === 1
          ? "Submission deleted."
          : `${items.length} submissions deleted.`
      )
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete submissions"
      )
    } finally {
      setUpdating(false)
    }
  }

  const selectedCount = selectedKeys.size
  const deleteCount = pendingDeleteItems?.length ?? 0

  return (
    <div className="space-y-4">
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={updating}
            onClick={() => bulkMark("read")}
          >
            Mark as read
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updating}
            onClick={() => bulkMark("new")}
          >
            Mark as unread
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={updating}
            onClick={() =>
              requestDelete(
                submissions.filter((submission) =>
                  selectedKeys.has(submissionKey(submission))
                )
              )
            }
          >
            Delete
          </Button>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  allPageSelected
                    ? true
                    : somePageSelected
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                aria-label="Select all submissions on this page"
              />
            </TableHead>
            <TableHead className="w-10" />
            <TableHead>From</TableHead>
            <TableHead>Form</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-32 text-center text-sm text-muted-foreground"
              >
                No submissions yet. Once a visitor fills out a form, it will
                appear here.
              </TableCell>
            </TableRow>
          ) : (
            paginatedSubmissions.map((submission) => {
              const key = submissionKey(submission)
              const isExpanded = expandedKeys.has(key)
              const isSelected = selectedKeys.has(key)
              const unread = isUnreadSubmission(submission.status)
              const replyHref = buildReplyMailto(submission)

              return (
                <ContextMenu key={key}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      data-submission-key={key}
                      data-state={isExpanded ? "open" : "closed"}
                      className={cn(
                        "cursor-pointer",
                        isExpanded && "border-b-0",
                        unread && "bg-primary/5"
                      )}
                      onClick={() => toggleExpanded(submission)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleSelected(key, checked === true)
                          }
                          aria-label={`Select submission from ${submission.name ?? "Anonymous"}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <HugeiconsIcon
                          icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                          className="size-4"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {submission.name ?? "Anonymous"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {submission.email ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {submission.formId ?? "—"}
                      </TableCell>
                      <TableCell>
                        {submission.serviceName ?? "—"}
                        {submission.subServiceName ? (
                          <div className="text-xs text-muted-foreground">
                            {submission.subServiceName}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {unread ? (
                          <Badge variant="default">new</Badge>
                        ) : (
                          <Badge variant="secondary">
                            {submission.status ?? "read"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(submission.timestamp)}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  {isExpanded ? (
                    <ContextMenuTrigger asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={7} className="p-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Message
                              </p>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {submission.message?.trim() ||
                                  "No message was included with this submission."}
                              </p>
                            </div>
                            {submission.phone ? (
                              <p className="text-sm text-muted-foreground">
                                Phone: {submission.phone}
                              </p>
                            ) : null}
                            {submission.source ? (
                              <p className="text-sm text-muted-foreground">
                                Source page: {submission.source}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2">
                              {replyHref ? (
                                <Button asChild size="sm" variant="default">
                                  <a href={replyHref}>
                                    <HugeiconsIcon
                                      icon={Mail01Icon}
                                      className="size-4"
                                    />
                                    Reply
                                  </a>
                                </Button>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No email address was provided for this
                                  submission.
                                </p>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={updating}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  requestDelete([submission])
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                  ) : null}
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      disabled={updating || !unread}
                      onSelect={() => void applyStatus([submission], "read")}
                    >
                      Mark as read
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={updating || unread}
                      onSelect={() => void applyStatus([submission], "new")}
                    >
                      Mark as unread
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      disabled={updating}
                      onSelect={() => requestDelete([submission])}
                    >
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })
          )}
        </TableBody>
      </Table>

      {submissions.length > PAGE_SIZE ? (
        <TablePagination
          total={submissions.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onPageSizeChange={() => {}}
          pageSizeOptions={[PAGE_SIZE]}
        />
      ) : null}

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open)
          if (!open) setPendingDeleteItems(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteCount === 1
                ? "Delete submission?"
                : `Delete ${deleteCount} submissions?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCount === 1
                ? "This permanently removes the submission. This cannot be undone."
                : "This permanently removes the selected submissions. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              disabled={updating}
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
    </div>
  )
}

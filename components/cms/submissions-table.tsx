"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"

import { TablePagination } from "@/components/cms/table-pagination"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

interface SubmissionsTableProps {
  initialSubmissions: SubmissionRow[]
}

export function SubmissionsTable({
  initialSubmissions,
}: SubmissionsTableProps) {
  const router = useRouter()
  const [submissions, setSubmissions] =
    useState<SubmissionRow[]>(initialSubmissions)
  const [page, setPage] = useState(1)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)

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

  const selectedCount = selectedKeys.size

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
                <Fragment key={key}>
                  <TableRow
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
                  {isExpanded ? (
                    <TableRow key={`${key}-details`} className="bg-muted/30">
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
                              No email address was provided for this submission.
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
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
    </div>
  )
}

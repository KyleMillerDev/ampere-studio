import Link from "next/link"
import {
  PackageIcon,
  Folder01Icon,
  Image01Icon,
  InboxIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { PageHeading } from "@/components/cms/page-heading"
import { StatCard } from "@/components/cms/stat-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { countCategories } from "@/lib/cms/categories"
import { countImages } from "@/lib/cms/images"
import { countProducts } from "@/lib/cms/products"
import { countSubmissionsSince, listSubmissions } from "@/lib/cms/submissions"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

async function safeNumber(fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

async function safeSubmissionList() {
  try {
    return await listSubmissions({ limit: 5 })
  } catch {
    return []
  }
}

function formatStat(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US")
}

export default async function DashboardPage() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [productCount, categoryCount, imageCount, recentSubmissionsCount, recent] =
    await Promise.all([
      safeNumber(countProducts),
      safeNumber(countCategories),
      safeNumber(countImages),
      safeNumber(() => countSubmissionsSince(thirtyDaysAgo.toISOString())),
      safeSubmissionList(),
    ])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Workspace overview"
        description="A snapshot of what is in your catalog and what your sites are capturing."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={formatStat(productCount)}
          hint="Active + draft rows in the catalog."
          icon={PackageIcon}
        />
        <StatCard
          label="Categories"
          value={formatStat(categoryCount)}
          hint="Used for grouping products on your site."
          icon={Folder01Icon}
        />
        <StatCard
          label="Media library"
          value={formatStat(imageCount)}
          hint="Images stored in the Ampere Studio bucket."
          icon={Image01Icon}
        />
        <StatCard
          label="Submissions (30d)"
          value={formatStat(recentSubmissionsCount)}
          hint="Form submissions captured in the last 30 days."
          icon={InboxIcon}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Recent submissions</CardTitle>
            <CardDescription>
              The latest five entries across every form on your site.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/submissions">
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No submissions yet. Once a visitor fills out a form on the site, it will show up here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((s) => (
                  <TableRow key={s.submissionId}>
                    <TableCell>
                      <div className="font-medium">{s.name ?? "Anonymous"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.email ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.formId ?? s.serviceName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.status === "new" ? "default" : "secondary"}
                      >
                        {s.status ?? "new"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(s.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

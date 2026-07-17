import { PageHeading } from "@/components/cms/page-heading"
import { SubmissionsTable } from "@/components/cms/submissions-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listSubmissions } from "@/lib/cms/submissions"

export const dynamic = "force-dynamic"

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ submissionId?: string; timestamp?: string }>
}) {
  const params = await searchParams
  const submissions = await listSubmissions()

  return (
    <div className="space-y-6">
      <PageHeading
        title="Form submissions"
        description="Every lead, inquiry, and message captured on your sites."
      />
      <Card>
        <CardHeader>
          <CardTitle>All submissions</CardTitle>
          <CardDescription>
            {submissions.length.toLocaleString()} total entries, 15 per page.
            Expand a row to read the full message and reply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubmissionsTable
            initialSubmissions={submissions}
            focusSubmissionId={params.submissionId}
            focusTimestamp={params.timestamp}
          />
        </CardContent>
      </Card>
    </div>
  )
}

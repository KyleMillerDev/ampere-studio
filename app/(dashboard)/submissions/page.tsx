import { PageHeading } from "@/components/cms/page-heading"
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
import { listSubmissions } from "@/lib/cms/submissions"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SubmissionsPage() {
  const submissions = await listSubmissions({ limit: 200 }).catch(() => [])

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
            Showing the most recent {submissions.length.toLocaleString()} entries from
            the Ampere-Sites-Form-Submissions table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                    colSpan={5}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No submissions yet. Once a visitor fills out a form, it will
                    appear here.
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((s) => (
                  <TableRow key={s.submissionId}>
                    <TableCell>
                      <div className="font-medium">{s.name ?? "Anonymous"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.email ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.formId ?? "—"}
                    </TableCell>
                    <TableCell>
                      {s.serviceName ?? "—"}
                      {s.subServiceName ? (
                        <div className="text-xs text-muted-foreground">
                          {s.subServiceName}
                        </div>
                      ) : null}
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

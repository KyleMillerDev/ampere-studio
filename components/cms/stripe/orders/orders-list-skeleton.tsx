import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function OrderRowSkeleton({ expanded = false }: { expanded?: boolean }) {
  return (
    <>
      <TableRow>
        <TableCell className="px-3">
          <Skeleton className="size-4" />
        </TableCell>
        <TableCell>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-28" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-5 w-16 rounded-full" />
        </TableCell>
        <TableCell className="text-right">
          <Skeleton className="ml-auto h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="ml-auto size-8 rounded-md" />
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={4} className="pt-2 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="size-10 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
                <div className="mt-3 space-y-1.5 border-t pt-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell />
        </TableRow>
      ) : null}
    </>
  )
}

export function OrdersListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 min-w-64 flex-1" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Matches orders table: cards until lg, then table */}
      <div className="@container hidden rounded-lg border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Date</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <OrderRowSkeleton expanded />
            <OrderRowSkeleton />
            <OrderRowSkeleton />
            <OrderRowSkeleton />
            <OrderRowSkeleton />
            <OrderRowSkeleton />
          </TableBody>
        </Table>
      </div>
      <div className="@container overflow-hidden rounded-lg border bg-card lg:hidden">
        <div className="divide-y">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2.5 px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

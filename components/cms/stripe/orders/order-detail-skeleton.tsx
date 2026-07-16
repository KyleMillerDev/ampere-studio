import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function LineItemSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-14 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

function SidebarCardSkeleton({
  lines = 2,
  titleWidth = "w-20",
}: {
  lines?: number
  titleWidth?: string
}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`h-5 ${titleWidth}`} />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === 0 ? "w-36" : "w-48"}`} />
        ))}
      </CardContent>
    </Card>
  )
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-14" />
            </CardHeader>
            <CardContent className="space-y-3">
              <LineItemSkeleton />
              <LineItemSkeleton />
              <LineItemSkeleton />
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-18" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-14" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-16 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <SidebarCardSkeleton lines={2} titleWidth="w-20" />
          <SidebarCardSkeleton lines={4} titleWidth="w-16" />
          <SidebarCardSkeleton lines={2} titleWidth="w-20" />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

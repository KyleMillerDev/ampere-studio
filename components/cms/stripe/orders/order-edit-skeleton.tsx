import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function EditorLineSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-12 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="size-9 rounded-md" />
    </div>
  )
}

export function OrderEditSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: line items + discount */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <EditorLineSkeleton />
              <EditorLineSkeleton />
              <EditorLineSkeleton />
              <Separator />
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="size-9 rounded-md" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>

        {/* Right: summary + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-18" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Separator />
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="mt-2 h-16 w-full rounded-md" />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}

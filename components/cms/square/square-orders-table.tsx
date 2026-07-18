"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpDownIcon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { SquareOrderRowActions } from "@/components/cms/square/order-actions"
import { TablePagination } from "@/components/cms/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { KmOrderState, SquareOrder } from "@/lib/square/types"
import { cn } from "@/lib/utils"

const stateVariant: Record<
  KmOrderState,
  "default" | "secondary" | "outline" | "destructive"
> = {
  OPEN: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELED: "destructive",
  ABANDONED_CHECKOUT: "destructive",
}

const stateLabels: Record<KmOrderState, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  ABANDONED_CHECKOUT: "Abandoned",
}

function formatMoney(amount?: number): string {
  if (amount === undefined) return "—"
  return `$${(amount / 100).toFixed(2)}`
}

type SortKey = "date_desc" | "date_asc" | "total_desc" | "total_asc"

type StateFilter = "all" | KmOrderState

function sortOrders(orders: SquareOrder[], key: SortKey): SquareOrder[] {
  return [...orders].sort((a, b) => {
    switch (key) {
      case "date_desc":
        return (b.created_at ?? "").localeCompare(a.created_at ?? "")
      case "date_asc":
        return (a.created_at ?? "").localeCompare(b.created_at ?? "")
      case "total_desc":
        return (b.total_money?.amount ?? 0) - (a.total_money?.amount ?? 0)
      case "total_asc":
        return (a.total_money?.amount ?? 0) - (b.total_money?.amount ?? 0)
    }
  })
}

interface Props {
  orders: SquareOrder[]
}

export function SquareOrdersTable({ orders }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("date_desc")
  const [stateFilter, setStateFilter] = useState<StateFilter>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [syncing, setSyncing] = useState(false)

  const filtered = sortOrders(
    orders.filter((o) => {
      if (
        search &&
        !o.id.includes(search) &&
        !o.line_items?.[0]?.name?.toLowerCase().includes(search.toLowerCase())
      )
        return false
      if (stateFilter !== "all" && o.km_state !== stateFilter) return false
      return true
    }),
    sortKey
  )

  useEffect(() => {
    setPage(1)
  }, [search, sortKey, stateFilter])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/square/sync", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      toast.success("Orders synced")
      router.refresh()
    } catch {
      toast.error("Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No orders in the mirror yet. Run a full sync to populate orders.
      </div>
    )
  }

  const stateCounts = orders.reduce<Partial<Record<KmOrderState, number>>>(
    (acc, o) => {
      if (o.km_state) acc[o.km_state] = (acc[o.km_state] ?? 0) + 1
      return acc
    },
    {}
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by order ID or item name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-9 w-44 gap-1.5">
            <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="total_desc">Highest total</SelectItem>
            <SelectItem value="total_asc">Lowest total</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={stateFilter}
          onValueChange={(v) => setStateFilter(v as StateFilter)}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(stateLabels) as KmOrderState[]).map((s) => (
              <SelectItem key={s} value={s}>
                {stateLabels[s]}
                {stateCounts[s] !== undefined && (
                  <span className="ml-1.5 text-muted-foreground">
                    ({stateCounts[s]})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {stateFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => setStateFilter("all")}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {orders.length} orders
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          disabled={syncing}
          onClick={handleSync}
        >
          <RefreshCwIcon
            className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          No orders match your filters.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>First item</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((order) => {
                const state = (order.km_state ?? "OPEN") as KmOrderState
                const firstItem = order.line_items?.[0]
                const fulfillment = order.fulfillments?.[0]

                return (
                  <SquareOrderRowActions key={order.id} order={order}>
                    {(dropdown) => (
                      <TableRow
                        className={cn(
                          "cursor-default",
                          entityContextTargetClass
                        )}
                      >
                        <TableCell className="font-mono text-xs">
                          {order.id.slice(-8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stateVariant[state]}>
                            {stateLabels[state]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {firstItem?.name ?? "—"}
                            {(order.line_items?.length ?? 0) > 1 && (
                              <span className="ml-1 text-muted-foreground">
                                +{(order.line_items?.length ?? 1) - 1}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(order.total_money?.amount)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {fulfillment?.type ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">{dropdown}</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </SquareOrderRowActions>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > pageSize && (
        <TablePagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}

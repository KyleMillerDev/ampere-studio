"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  PROPERTY_TYPES,
  RENTAL_STATUS_LABELS,
  type RentalRecord,
} from "@/lib/validation/rental.schema"
import { formatDate } from "@/lib/utils"

const ALL = "__all__"

const globalFilterFn: FilterFn<RentalRecord> = (row, _colId, value: string) => {
  const q = value.toLowerCase()
  const r = row.original
  return (
    r.address.street.toLowerCase().includes(q) ||
    r.address.city.toLowerCase().includes(q) ||
    r.slug.toLowerCase().includes(q) ||
    r.propertyType.toLowerCase().includes(q)
  )
}

interface RentalsTableProps {
  rentals: RentalRecord[]
}

export function RentalsTable({ rentals }: RentalsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)

  const filtered = useMemo(() => {
    return rentals.filter((r) => {
      if (statusFilter !== ALL && r.status !== statusFilter) return false
      if (typeFilter !== ALL && r.propertyType !== typeFilter) return false
      return true
    })
  }, [rentals, statusFilter, typeFilter])

  async function handleStatusChange(id: string, status: "active" | "rented") {
    const res = await fetch(`/api/rentals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast.error("Could not update status")
      return
    }
    toast.success(
      status === "active" ? "Listing marked For Rent" : "Listing marked Rented"
    )
    router.refresh()
  }

  const columns = useMemo(() => {
    const col = createColumnHelper<RentalRecord>()
    return [
      col.display({
        id: "image",
        header: "",
        cell: (info) => {
          const url = info.row.original.images?.[0]
          if (!url) {
            return (
              <div className="flex size-12 shrink-0 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                No img
              </div>
            )
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="size-12 shrink-0 rounded border object-cover"
              loading="lazy"
            />
          )
        },
      }),
      col.accessor(
        (r) =>
          `${r.address.street}, ${r.address.city}, ${r.address.state} ${r.address.zip}`,
        {
          id: "address",
          header: "Address",
          cell: (info) => (
            <div className="min-w-0">
              <Link
                href={`/rentals/${info.row.original.id}`}
                className="font-medium hover:underline"
              >
                {info.row.original.address.street}
              </Link>
              <div className="text-xs text-muted-foreground">
                {info.row.original.address.city},{" "}
                {info.row.original.address.state}{" "}
                {info.row.original.address.zip}
              </div>
            </div>
          ),
        }
      ),
      col.accessor("price", {
        header: "Rent",
        cell: (info) => (
          <span className="font-medium whitespace-nowrap">
            ${info.getValue().toLocaleString("en-US")}/mo
          </span>
        ),
      }),
      col.display({
        id: "specs",
        header: "Beds / Baths / Sqft",
        cell: (info) => {
          const r = info.row.original
          return (
            <span className="text-sm whitespace-nowrap">
              {r.beds}bd &middot; {r.baths}ba &middot;{" "}
              {r.sqft.toLocaleString("en-US")} sqft
            </span>
          )
        },
      }),
      col.accessor("propertyType", {
        header: "Type",
        cell: (info) => (
          <span className="capitalize">
            {info.getValue().replace(/-/g, " ")}
          </span>
        ),
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => {
          const current = info.getValue() as "active" | "rented"
          const next = current === "active" ? "rented" : "active"
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto px-2 py-1" size="sm">
                  <Badge
                    variant={current === "active" ? "default" : "secondary"}
                  >
                    {RENTAL_STATUS_LABELS[current]}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => handleStatusChange(info.row.original.id, next)}
                >
                  Mark as{" "}
                  <span className="font-medium">
                    {RENTAL_STATUS_LABELS[next]}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      }),
      col.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => (
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Row actions">
                  <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/rentals/${info.row.original.id}`}>Edit</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    const label = `${info.row.original.address.street}, ${info.row.original.address.city}`
                    const ok = window.confirm(`Delete "${label}"?`)
                    if (!ok) return
                    const res = await fetch(
                      `/api/rentals/${info.row.original.id}`,
                      { method: "DELETE" }
                    )
                    if (!res.ok) {
                      toast.error("Could not delete rental")
                      return
                    }
                    toast.success("Rental deleted")
                    router.refresh()
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      }),
    ]
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search address, city, or type..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {Object.entries(RENTAL_STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {PROPERTY_TYPES.map((pt) => (
              <SelectItem key={pt} value={pt}>
                {pt.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className={
                      h.column.getCanSort() ? "cursor-pointer select-none" : ""
                    }
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {rentals.length === 0
                    ? "No rentals yet. Create the first listing to get started."
                    : "No rentals match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

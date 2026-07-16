"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpDownIcon, Trash2Icon } from "lucide-react"

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
import { TablePagination } from "@/components/cms/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

import type { SquareMirrorDiscount } from "@/lib/square/types"

interface Props {
  discounts: SquareMirrorDiscount[]
}

type SortKey =
  | "name_asc"
  | "name_desc"
  | "amount_desc"
  | "amount_asc"
  | "created_desc"
  | "created_asc"

type ActiveFilter = "all" | "active" | "inactive"

function discountLabel(d: SquareMirrorDiscount): string {
  const disc = d.discount.discount_data
  if (disc.discount_type === "FIXED_PERCENTAGE" && disc.percentage) {
    return `${disc.percentage}% off`
  }
  if (disc.discount_type === "FIXED_AMOUNT" && disc.amount_money) {
    return `$${(disc.amount_money.amount / 100).toFixed(2)} off`
  }
  return "Discount"
}

function discountSortValue(d: SquareMirrorDiscount): number {
  const disc = d.discount.discount_data
  if (disc.amount_money?.amount) return disc.amount_money.amount
  if (disc.percentage) return parseFloat(disc.percentage) * 100
  return 0
}

function sortDiscounts(
  discounts: SquareMirrorDiscount[],
  key: SortKey
): SquareMirrorDiscount[] {
  return [...discounts].sort((a, b) => {
    switch (key) {
      case "name_asc":
        return (a.discount.discount_data.name ?? "").localeCompare(
          b.discount.discount_data.name ?? ""
        )
      case "name_desc":
        return (b.discount.discount_data.name ?? "").localeCompare(
          a.discount.discount_data.name ?? ""
        )
      case "amount_asc":
        return discountSortValue(a) - discountSortValue(b)
      case "amount_desc":
        return discountSortValue(b) - discountSortValue(a)
      case "created_asc":
        return (a.created_at ?? "").localeCompare(b.created_at ?? "")
      case "created_desc":
        return (b.created_at ?? "").localeCompare(a.created_at ?? "")
    }
  })
}

export function SquareDiscountsTable({ discounts }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name_asc")
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [deleteTarget, setDeleteTarget] = useState<SquareMirrorDiscount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = sortDiscounts(
    discounts.filter((d) => {
      const name = d.discount.discount_data.name ?? ""
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false
      if (activeFilter === "active" && !d.is_active) return false
      if (activeFilter === "inactive" && d.is_active) return false
      return true
    }),
    sortKey
  )

  useEffect(() => { setPage(1) }, [search, sortKey, activeFilter])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function handleDelete(d: SquareMirrorDiscount) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/square/discounts/${d.raw_id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success("Discount deleted")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Search discounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-56"
        />

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-9 w-48 gap-1.5">
            <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name A → Z</SelectItem>
            <SelectItem value="name_desc">Name Z → A</SelectItem>
            <SelectItem value="amount_desc">Highest value</SelectItem>
            <SelectItem value="amount_asc">Lowest value</SelectItem>
            <SelectItem value="created_desc">Newest first</SelectItem>
            <SelectItem value="created_asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {activeFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => setActiveFilter("all")}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {discounts.length} discounts
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          {search || activeFilter !== "all"
            ? "No discounts match your filters."
            : "No discounts yet."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discount</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid from</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Targets</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((d) => (
                <TableRow key={d.raw_id}>
                  <TableCell className="font-medium">
                    {d.discount.discount_data.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{discountLabel(d)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.pricing_rule?.pricing_rule_data.valid_from_date ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.pricing_rule?.pricing_rule_data.valid_until_date ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.target_product_ids.length + d.target_category_ids.length === 0
                      ? "All products"
                      : `${d.target_product_ids.length + d.target_category_ids.length} items`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.created_at
                      ? new Date(d.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(d)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete discount?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the discount and its pricing rule
              from Square.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

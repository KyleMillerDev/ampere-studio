"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCents, formatDate } from "@/lib/utils"
import type { Product } from "@/lib/validation/product.schema"
import type { Category } from "@/lib/validation/category.schema"

interface ProductsTableProps {
  products: Product[]
  categories: Category[]
}

export function ProductsTable({ products, categories }: ProductsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  )

  const columns = useMemo(() => {
    const col = createColumnHelper<Product>()
    return [
      col.accessor("name", {
        header: "Name",
        cell: (info) => (
          <div className="space-y-0.5">
            <Link
              href={`/products/${info.row.original.id}`}
              className="font-medium hover:underline"
            >
              {info.getValue()}
            </Link>
            {info.row.original.sku ? (
              <div className="text-xs text-muted-foreground">
                SKU {info.row.original.sku}
              </div>
            ) : null}
          </div>
        ),
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => {
          const value = info.getValue()
          const variant =
            value === "active"
              ? "default"
              : value === "archived"
                ? "outline"
                : "secondary"
          return <Badge variant={variant}>{value}</Badge>
        },
      }),
      col.accessor("priceCents", {
        header: "Price",
        cell: (info) => formatCents(info.getValue()),
      }),
      col.accessor("inventory", {
        header: "Inventory",
        cell: (info) => info.getValue().toLocaleString("en-US"),
      }),
      col.accessor(
        (row) => (row.categoryId ? (categoryMap.get(row.categoryId) ?? "—") : "—"),
        {
          id: "category",
          header: "Category",
          cell: (info) => info.getValue(),
        }
      ),
      col.accessor("updatedAt", {
        header: "Updated",
        cell: (info) => formatDate(info.getValue()),
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
                  <Link href={`/products/${info.row.original.id}`}>Edit</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    const ok = window.confirm(
                      `Delete "${info.row.original.name}"?`
                    )
                    if (!ok) return
                    const res = await fetch(
                      `/api/products/${info.row.original.id}`,
                      { method: "DELETE" }
                    )
                    if (!res.ok) {
                      toast.error("Could not delete product")
                      return
                    }
                    toast.success("Product deleted")
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
  }, [categoryMap, router])

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
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
                No products yet. Create your first product to populate the storefront.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

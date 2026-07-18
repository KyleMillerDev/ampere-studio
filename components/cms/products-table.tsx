"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { entityContextTargetClass } from "@/components/cms/entity-row-actions"
import { CmsProductRowActions } from "@/components/cms/product-actions"
import { formatCents, formatDate } from "@/lib/utils"
import type { Product } from "@/lib/validation/product.schema"
import type { Category } from "@/lib/validation/category.schema"

interface ProductsTableProps {
  products: Product[]
  categories: Category[]
}

export function ProductsTable({ products, categories }: ProductsTableProps) {
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
        (row) =>
          row.categoryId ? (categoryMap.get(row.categoryId) ?? "—") : "—",
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
        cell: () => null,
      }),
    ]
  }, [categoryMap])

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
                No products yet. Create your first product to populate the
                storefront.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const product = row.original
              return (
                <CmsProductRowActions
                  key={row.id}
                  product={{ id: product.id, name: product.name }}
                >
                  {(dropdown) => (
                    <TableRow className={entityContextTargetClass}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.column.id === "actions" ? (
                            <div className="flex justify-end">{dropdown}</div>
                          ) : (
                            flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </CmsProductRowActions>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

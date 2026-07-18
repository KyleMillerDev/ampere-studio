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
import { HugeiconsIcon } from "@hugeicons/react"
import { Image01Icon } from "@hugeicons/core-free-icons"

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
import { StripeProductRowActions } from "@/components/cms/stripe/product-actions"
import { formatStripeAmount, formatUnixDate } from "@/lib/utils"
import type { StripeProductView } from "@/lib/validation/stripe-product.schema"

function priceLabel(product: StripeProductView): string {
  const price = product.defaultPrice
  if (!price) return "—"
  const amount = formatStripeAmount(price.unitAmount, price.currency)
  if (price.type === "recurring" && price.interval) {
    const every =
      price.intervalCount && price.intervalCount > 1
        ? `${price.intervalCount} ${price.interval}s`
        : price.interval
    return `${amount} / ${every}`
  }
  return amount
}

interface StripeProductsTableProps {
  products: StripeProductView[]
}

export function StripeProductsTable({ products }: StripeProductsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(() => {
    const col = createColumnHelper<StripeProductView>()
    return [
      col.display({
        id: "image",
        header: "",
        cell: (info) => {
          const src = info.row.original.images[0]
          return (
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={info.row.original.name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <HugeiconsIcon
                  icon={Image01Icon}
                  className="size-4 text-muted-foreground"
                />
              )}
            </div>
          )
        },
      }),
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
            <div className="text-xs text-muted-foreground">
              {info.row.original.id}
            </div>
          </div>
        ),
      }),
      col.accessor("active", {
        header: "Status",
        cell: (info) => (
          <Badge variant={info.getValue() ? "default" : "outline"}>
            {info.getValue() ? "active" : "archived"}
          </Badge>
        ),
      }),
      col.accessor((row) => row.defaultPrice?.unitAmount ?? -1, {
        id: "price",
        header: "Default price",
        cell: (info) => priceLabel(info.row.original),
      }),
      col.accessor((row) => row.images.length, {
        id: "imageCount",
        header: "Images",
        cell: (info) => info.getValue(),
      }),
      col.accessor("created", {
        header: "Created",
        cell: (info) => formatUnixDate(info.getValue()),
      }),
      col.display({
        id: "actions",
        header: "",
        cell: () => null,
      }),
    ]
  }, [])

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
                No Stripe products yet. Create your first product to start
                selling.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const product = row.original
              return (
                <StripeProductRowActions
                  key={row.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    active: product.active,
                  }}
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
                </StripeProductRowActions>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

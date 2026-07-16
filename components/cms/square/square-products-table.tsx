"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpDownIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageNotFound01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TablePagination } from "@/components/cms/table-pagination"

import type { SquareMirrorProduct } from "@/lib/square/types"

interface Props {
  products: SquareMirrorProduct[]
}

type SortKey =
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "created_desc"
  | "created_asc"
  | "inventory_desc"
  | "inventory_asc"

type StatusFilter = "all" | "published" | "draft"
type DiscountFilter = "all" | "has_discount" | "no_discount"

function formatPrice(cents: number | undefined): string {
  if (cents === undefined) return "—"
  return `$${(cents / 100).toFixed(2)}`
}

function firstPrice(product: SquareMirrorProduct): number {
  return (
    product.item_data.variations?.[0]?.item_variation_data.price_money?.amount ?? 0
  )
}

function totalInventory(product: SquareMirrorProduct): number {
  const variations = product.item_data.variations ?? []
  const inventoried = variations.filter(
    (v) =>
      v.item_variation_data.track_inventory &&
      v.item_variation_data.km_inventory !== undefined
  )
  if (inventoried.length === 0) return -1
  return inventoried.reduce(
    (sum, v) => sum + (Number(v.item_variation_data.km_inventory) || 0),
    0
  )
}

function inventoryLabel(product: SquareMirrorProduct): string {
  const t = totalInventory(product)
  return t === -1 ? "—" : String(t)
}

function sortProducts(products: SquareMirrorProduct[], key: SortKey): SquareMirrorProduct[] {
  return [...products].sort((a, b) => {
    switch (key) {
      case "name_asc":
        return a.item_data.name.localeCompare(b.item_data.name)
      case "name_desc":
        return b.item_data.name.localeCompare(a.item_data.name)
      case "price_asc":
        return firstPrice(a) - firstPrice(b)
      case "price_desc":
        return firstPrice(b) - firstPrice(a)
      case "created_asc":
        return (a.created_at ?? "").localeCompare(b.created_at ?? "")
      case "created_desc":
        return (b.created_at ?? "").localeCompare(a.created_at ?? "")
      case "inventory_asc": {
        const ai = totalInventory(a) === -1 ? Infinity : totalInventory(a)
        const bi = totalInventory(b) === -1 ? Infinity : totalInventory(b)
        return ai - bi
      }
      case "inventory_desc": {
        const ai = totalInventory(a) === -1 ? -Infinity : totalInventory(a)
        const bi = totalInventory(b) === -1 ? -Infinity : totalInventory(b)
        return bi - ai
      }
    }
  })
}

export function SquareProductsTable({ products }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("created_desc")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SquareMirrorProduct | null>(null)

  const filtered = sortProducts(
    products.filter((p) => {
      if (search && !p.item_data.name.toLowerCase().includes(search.toLowerCase()) && !p.slug.includes(search.toLowerCase())) return false
      if (statusFilter === "published" && p.km_status !== "Published") return false
      if (statusFilter === "draft" && p.km_status !== "Draft") return false
      if (discountFilter === "has_discount" && !(p.item_data.km_discount_amount && p.item_data.km_discount_amount > 0)) return false
      if (discountFilter === "no_discount" && p.item_data.km_discount_amount && p.item_data.km_discount_amount > 0) return false
      return true
    }),
    sortKey
  )

  // Reset to page 1 whenever the filtered set changes
  useEffect(() => { setPage(1) }, [search, sortKey, statusFilter, discountFilter])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function handleDelete(product: SquareMirrorProduct) {
    setDeleting(product.raw_id)
    try {
      const res = await fetch(`/api/square/products/${product.raw_id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success(`"${product.item_data.name}" deleted`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(null)
      setDeleteTarget(null)
    }
  }

  const activeFilterCount = [
    statusFilter !== "all",
    discountFilter !== "all",
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search products..."
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
            <SelectItem value="created_desc">Newest first</SelectItem>
            <SelectItem value="created_asc">Oldest first</SelectItem>
            <SelectItem value="name_asc">Name A → Z</SelectItem>
            <SelectItem value="name_desc">Name Z → A</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
            <SelectItem value="inventory_desc">Most inventory</SelectItem>
            <SelectItem value="inventory_asc">Least inventory</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        <Select value={discountFilter} onValueChange={(v) => setDiscountFilter(v as DiscountFilter)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Discount" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            <SelectItem value="has_discount">Has discount</SelectItem>
            <SelectItem value="no_discount">No discount</SelectItem>
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setStatusFilter("all")
              setDiscountFilter("all")
            }}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {products.length} products
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          {search || activeFilterCount > 0
            ? "No products match your filters."
            : "No products yet."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Variations</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((product) => {
                const price = firstPrice(product) || undefined
                const variationCount = product.item_data.variations?.length ?? 0
                const discount = product.item_data.km_discount_amount

                return (
                  <TableRow key={product.raw_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {product.item_data.image_urls?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.item_data.image_urls[0]}
                              alt={product.item_data.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <HugeiconsIcon
                              icon={ImageNotFound01Icon}
                              className="size-4 text-muted-foreground"
                            />
                          )}
                        </div>
                        <div>
                          <p className="leading-none font-medium">
                            {product.item_data.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {product.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.km_status === "Published"
                            ? "default"
                            : product.km_status === "Draft"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {product.km_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPrice(price)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {variationCount === 1
                          ? "1 variation"
                          : `${variationCount} variations`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{inventoryLabel(product)}</span>
                    </TableCell>
                    <TableCell>
                      {discount && discount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-green-200 text-green-600"
                        >
                          -{formatPrice(discount)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.raw_id}/edit`}>
                              <PencilIcon className="mr-2 size-3.5" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2Icon className="mr-2 size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.item_data.name}
              &quot; from Square and the mirror. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              disabled={deleting !== null}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

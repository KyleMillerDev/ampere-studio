"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpDownIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

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

import type { SquareMirrorCategory } from "@/lib/square/types"

interface Props {
  categories: SquareMirrorCategory[]
}

type SortKey =
  | "name_asc"
  | "name_desc"
  | "product_count_desc"
  | "product_count_asc"
  | "created_desc"
  | "created_asc"

type StatusFilter = "all" | "published" | "draft"
type VisibilityFilter = "all" | "online" | "hidden"

function sortCategories(
  cats: SquareMirrorCategory[],
  key: SortKey
): SquareMirrorCategory[] {
  return [...cats].sort((a, b) => {
    switch (key) {
      case "name_asc":
        return a.category_data.name.localeCompare(b.category_data.name)
      case "name_desc":
        return b.category_data.name.localeCompare(a.category_data.name)
      case "product_count_asc":
        return (
          (a.category_data.km_product_ids?.length ?? 0) -
          (b.category_data.km_product_ids?.length ?? 0)
        )
      case "product_count_desc":
        return (
          (b.category_data.km_product_ids?.length ?? 0) -
          (a.category_data.km_product_ids?.length ?? 0)
        )
      case "created_asc":
        return (a.created_at ?? "").localeCompare(b.created_at ?? "")
      case "created_desc":
        return (b.created_at ?? "").localeCompare(a.created_at ?? "")
    }
  })
}

export function SquareCategoriesTable({ categories }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name_asc")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [deleteTarget, setDeleteTarget] = useState<SquareMirrorCategory | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = sortCategories(
    categories.filter((cat) => {
      if (
        search &&
        !cat.category_data.name.toLowerCase().includes(search.toLowerCase()) &&
        !cat.slug.includes(search.toLowerCase())
      )
        return false
      if (statusFilter === "published" && cat.km_status !== "Published") return false
      if (statusFilter === "draft" && cat.km_status !== "Draft") return false
      if (visibilityFilter === "online" && !cat.category_data.online_visibility) return false
      if (visibilityFilter === "hidden" && cat.category_data.online_visibility) return false
      return true
    }),
    sortKey
  )

  useEffect(() => { setPage(1) }, [search, sortKey, statusFilter, visibilityFilter])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function handleDelete(cat: SquareMirrorCategory) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/square/categories/${cat.raw_id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success(`"${cat.category_data.name}" deleted`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const activeFilterCount = [
    statusFilter !== "all",
    visibilityFilter !== "all",
  ].filter(Boolean).length

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Search categories..."
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
            <SelectItem value="product_count_desc">Most products</SelectItem>
            <SelectItem value="product_count_asc">Fewest products</SelectItem>
            <SelectItem value="created_desc">Newest first</SelectItem>
            <SelectItem value="created_asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={visibilityFilter}
          onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any visibility</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setStatusFilter("all")
              setVisibilityFilter("all")
            }}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {categories.length} categories
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          {search || activeFilterCount > 0 ? (
            "No categories match your filters."
          ) : (
            <>
              No categories yet.{" "}
              <Link href="/square/categories/new" className="underline">
                Create one
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((cat) => (
                <TableRow key={cat.raw_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {cat.category_data.image_urls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cat.category_data.image_urls[0]}
                          alt=""
                          className="size-9 rounded object-cover"
                        />
                      ) : (
                        <div className="size-9 rounded bg-muted" />
                      )}
                      <div>
                        <p className="leading-none font-medium">
                          {cat.category_data.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {cat.slug}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        cat.km_status === "Published" ? "default" : "secondary"
                      }
                    >
                      {cat.km_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {cat.category_data.km_product_ids?.length ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        cat.category_data.online_visibility ? "outline" : "secondary"
                      }
                    >
                      {cat.category_data.online_visibility ? "Online" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cat.created_at
                      ? new Date(cat.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/square/categories/${cat.raw_id}/edit`}>
                            <PencilIcon className="mr-2 size-3.5" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <Trash2Icon className="mr-2 size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;
              {deleteTarget?.category_data.name}&quot; from Square. Products in
              this category will not be deleted.
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

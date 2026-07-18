"use client"

import { useState, type ReactElement, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PencilIcon, Trash2Icon } from "lucide-react"

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
import {
  EntityContextMenu,
  EntityRowActions,
  type EntityMenuParts,
} from "@/components/cms/entity-row-actions"

export type SquareProductActionTarget = {
  /** Catalog item raw id used in `/products/[id]` routes. */
  id: string
  name: string
}

function SquareProductMenuItems({
  product,
  onDelete,
  allowDelete,
  Item,
  Separator,
}: {
  product: SquareProductActionTarget
  onDelete: () => void
  allowDelete: boolean
} & EntityMenuParts) {
  return (
    <>
      <Item asChild>
        <Link href={`/products/${product.id}`}>View Product</Link>
      </Item>
      <Item asChild>
        <Link href={`/products/${product.id}/edit`}>
          <PencilIcon className="size-3.5" />
          Edit Product
        </Link>
      </Item>
      {allowDelete ? (
        <>
          <Separator />
          <Item
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2Icon className="size-3.5" />
            Delete Product
          </Item>
        </>
      ) : null}
    </>
  )
}

function DeleteProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: SquareProductActionTarget
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/square/products/${product.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success(`"${product.name}" deleted`)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete product?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &quot;{product.name}&quot; from Square
            and the mirror. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            disabled={loading}
            onClick={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function SquareProductRowActions({
  product,
  children,
  onContextMenuOpenChange,
  showDropdown = true,
  allowDelete = true,
}: {
  product: SquareProductActionTarget
  children: (dropdown: ReactNode) => ReactElement
  onContextMenuOpenChange?: (open: boolean) => void
  showDropdown?: boolean
  allowDelete?: boolean
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <EntityRowActions
        showDropdown={showDropdown}
        dropdownAriaLabel="Product actions"
        onContextMenuOpenChange={onContextMenuOpenChange}
        renderItems={(parts) => (
          <SquareProductMenuItems
            product={product}
            allowDelete={allowDelete}
            onDelete={() => setDeleteOpen(true)}
            {...parts}
          />
        )}
      >
        {children}
      </EntityRowActions>
      {allowDelete ? (
        <DeleteProductDialog
          product={product}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  )
}

export function SquareProductContextMenu({
  product,
  children,
  allowDelete = false,
}: {
  product: SquareProductActionTarget
  children: ReactElement
  allowDelete?: boolean
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!product.id || product.id === "unknown") {
    return children
  }

  return (
    <>
      <EntityContextMenu
        renderItems={(parts) => (
          <SquareProductMenuItems
            product={product}
            allowDelete={allowDelete}
            onDelete={() => setDeleteOpen(true)}
            {...parts}
          />
        )}
      >
        {children}
      </EntityContextMenu>
      {allowDelete ? (
        <DeleteProductDialog
          product={product}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  )
}

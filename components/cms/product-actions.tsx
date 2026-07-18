"use client"

import { useState, type ReactElement, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
  EntityRowActions,
  type EntityMenuParts,
} from "@/components/cms/entity-row-actions"

export type CmsProductActionTarget = {
  id: string
  name: string
}

function CmsProductMenuItems({
  product,
  onDelete,
  Item,
  Separator,
}: {
  product: CmsProductActionTarget
  onDelete: () => void
} & EntityMenuParts) {
  return (
    <>
      <Item asChild>
        <Link href={`/products/${product.id}`}>View Product</Link>
      </Item>
      <Item asChild>
        <Link href={`/products/${product.id}/edit`}>Edit Product</Link>
      </Item>
      <Separator />
      <Item
        className="text-destructive focus:text-destructive"
        onSelect={onDelete}
      >
        Delete Product
      </Item>
    </>
  )
}

export function CmsProductRowActions({
  product,
  children,
}: {
  product: CmsProductActionTarget
  children: (dropdown: ReactNode) => ReactElement
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        toast.error("Could not delete product")
        return
      }
      toast.success("Product deleted")
      setDeleteOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <EntityRowActions
        dropdownAriaLabel="Product actions"
        renderItems={(parts) => (
          <CmsProductMenuItems
            product={product}
            onDelete={() => setDeleteOpen(true)}
            {...parts}
          />
        )}
      >
        {children}
      </EntityRowActions>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{product.name}&quot;? This cannot be undone.
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
              {loading ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

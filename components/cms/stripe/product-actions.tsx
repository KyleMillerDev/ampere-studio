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
  EntityContextMenu,
  EntityRowActions,
  type EntityMenuParts,
} from "@/components/cms/entity-row-actions"

export type StripeProductActionTarget = {
  id: string
  name: string
  /** When false, archive is hidden. Defaults to true for table rows. */
  active?: boolean
}

function StripeProductMenuItems({
  product,
  onArchive,
  allowArchive,
  Item,
  Separator,
}: {
  product: StripeProductActionTarget
  onArchive: () => void
  allowArchive: boolean
} & EntityMenuParts) {
  const showArchive = allowArchive && product.active !== false

  return (
    <>
      <Item asChild>
        <Link href={`/products/${product.id}`}>View Product</Link>
      </Item>
      <Item asChild>
        <Link href={`/products/${product.id}/edit`}>Edit Product</Link>
      </Item>
      {showArchive ? (
        <>
          <Separator />
          <Item
            className="text-destructive focus:text-destructive"
            onSelect={onArchive}
          >
            Archive Product
          </Item>
        </>
      ) : null}
    </>
  )
}

function ArchiveProductDialog({
  product,
  open,
  onOpenChange,
  archiveUrl,
  archiveMessage,
}: {
  product: StripeProductActionTarget
  open: boolean
  onOpenChange: (open: boolean) => void
  archiveUrl: (productId: string) => string
  archiveMessage: (name: string) => string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleArchive() {
    setLoading(true)
    try {
      const res = await fetch(archiveUrl(product.id), {
        method: "DELETE",
      })
      if (!res.ok) {
        toast.error("Could not archive product")
        return
      }
      toast.success("Product archived")
      onOpenChange(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive product?</AlertDialogTitle>
          <AlertDialogDescription>
            {archiveMessage(product.name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            disabled={loading}
            onClick={(event) => {
              event.preventDefault()
              void handleArchive()
            }}
          >
            {loading ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const AMPERE_ARCHIVE_MESSAGE =
  "It stays in your catalog but is hidden from new use."
const STRIPE_ARCHIVE_MESSAGE =
  "It stays in Stripe but is hidden from new purchases."

function archiveUrlFor(
  catalogSource: "stripe" | "ampere",
  productId: string
): string {
  return catalogSource === "ampere"
    ? `/api/ampere/products/${productId}`
    : `/api/stripe/products/${productId}`
}

function archiveMessageFor(
  catalogSource: "stripe" | "ampere",
  name: string
): string {
  const suffix =
    catalogSource === "ampere" ? AMPERE_ARCHIVE_MESSAGE : STRIPE_ARCHIVE_MESSAGE
  return `Archive "${name}"? ${suffix}`
}

export function StripeProductRowActions({
  product,
  children,
  onContextMenuOpenChange,
  showDropdown = true,
  allowArchive = true,
  catalogSource = "stripe",
}: {
  product: StripeProductActionTarget
  children: (dropdown: ReactNode) => ReactElement
  onContextMenuOpenChange?: (open: boolean) => void
  showDropdown?: boolean
  allowArchive?: boolean
  catalogSource?: "stripe" | "ampere"
}) {
  const [archiveOpen, setArchiveOpen] = useState(false)

  return (
    <>
      <EntityRowActions
        showDropdown={showDropdown}
        dropdownAriaLabel="Product actions"
        onContextMenuOpenChange={onContextMenuOpenChange}
        renderItems={(parts) => (
          <StripeProductMenuItems
            product={product}
            allowArchive={allowArchive}
            onArchive={() => setArchiveOpen(true)}
            {...parts}
          />
        )}
      >
        {children}
      </EntityRowActions>
      {allowArchive ? (
        <ArchiveProductDialog
          product={product}
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          archiveUrl={(id) => archiveUrlFor(catalogSource, id)}
          archiveMessage={(name) => archiveMessageFor(catalogSource, name)}
        />
      ) : null}
    </>
  )
}

export function StripeProductContextMenu({
  product,
  children,
  allowArchive = false,
  catalogSource = "stripe",
}: {
  product: StripeProductActionTarget
  children: ReactElement
  /** Destructive archive is off by default on overview / embedded surfaces. */
  allowArchive?: boolean
  catalogSource?: "stripe" | "ampere"
}) {
  const [archiveOpen, setArchiveOpen] = useState(false)

  return (
    <>
      <EntityContextMenu
        renderItems={(parts) => (
          <StripeProductMenuItems
            product={product}
            allowArchive={allowArchive}
            onArchive={() => setArchiveOpen(true)}
            {...parts}
          />
        )}
      >
        {children}
      </EntityContextMenu>
      {allowArchive ? (
        <ArchiveProductDialog
          product={product}
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          archiveUrl={(id) => archiveUrlFor(catalogSource, id)}
          archiveMessage={(name) => archiveMessageFor(catalogSource, name)}
        />
      ) : null}
    </>
  )
}

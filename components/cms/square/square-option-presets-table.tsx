"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

import type { SquareOptionPreset } from "@/lib/square/types"

interface Props {
  presets: SquareOptionPreset[]
}

export function SquareOptionPresetsTable({ presets }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<SquareOptionPreset | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(preset: SquareOptionPreset) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/square/option-templates/${preset.raw_id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success(`"${preset.name}" deleted`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (presets.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No option presets yet.{" "}
        <Link href="/square/options/new" className="underline">
          Create one
        </Link>{" "}
        to speed up product creation.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preset name</TableHead>
              <TableHead>Option dimension</TableHead>
              <TableHead>Values</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {presets.map((preset) => (
              <TableRow key={preset.raw_id}>
                <TableCell className="font-medium">{preset.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {preset.option.item_option_data.name}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {preset.option.item_option_data.values
                      .slice(0, 5)
                      .map((v, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {v.item_option_value_data.name}
                          {v.item_option_value_data.km_markup
                            ? ` (+$${v.item_option_value_data.km_markup})`
                            : ""}
                        </Badge>
                      ))}
                    {preset.option.item_option_data.values.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{preset.option.item_option_data.values.length - 5} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(preset.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(preset)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete option preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the saved template. Products using this option
              are not affected.
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

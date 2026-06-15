"use client"

import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Upload01Icon,
  Image01Icon,
  Delete01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { StudioImage } from "@/lib/cms/images"
import { useEditorStore } from "@/components/cms/editor/editor-store"
import { cn } from "@/lib/utils"

export function ImagePickerDialog() {
  const { state, dispatch, pushValue } = useEditorStore()
  const open = state.mediaPicker.open
  const blockId = state.mediaPicker.blockId
  const [images, setImages] = useState<StudioImage[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let aborted = false
    setImages(null)
    setLoadError(null)
    setSelected(null)
    void (async () => {
      try {
        const res = await fetch("/api/images", { cache: "no-store" })
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const data = (await res.json()) as { images: StudioImage[] }
        if (aborted) return
        setImages(data.images.filter((img) => img.status === "ready"))
      } catch (err) {
        if (aborted) return
        setLoadError(err instanceof Error ? err.message : "Unknown error")
        setImages([])
      }
    })()
    return () => {
      aborted = true
    }
  }, [open])

  function close() {
    dispatch({ type: "close-media" })
  }

  function onInsert() {
    if (!blockId || !selected) return
    pushValue(blockId, "image", selected)
    dispatch({
      type: "upsert-change",
      change: {
        blockId,
        targetId: state.mediaPicker.targetId ?? "",
        sourceType:
          state.session.blocks.find((b) => b.blockId === blockId)?.sourceType ??
          "inline",
        type: "image",
        newValue: selected,
      },
    })
    toast.success("Image queued for publish")
    close()
  }

  function onUploaded(image: StudioImage) {
    setImages((prev) => (prev ? [image, ...prev] : [image]))
    setSelected(image.s3Url)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>
            Pick an image from your library, or upload a new one. Selected
            images queue as a pending change until you publish.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="gallery">
          <TabsList className="mb-3">
            <TabsTrigger value="gallery">
              <HugeiconsIcon icon={Image01Icon} className="mr-1 size-4" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="upload">
              <HugeiconsIcon icon={Upload01Icon} className="mr-1 size-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery">
            <GalleryTab
              images={images}
              loadError={loadError}
              selected={selected}
              onSelect={setSelected}
              onDelete={(id) => {
                setImages(
                  (prev) => prev?.filter((img) => img.id !== id) ?? prev
                )
              }}
            />
          </TabsContent>

          <TabsContent value="upload">
            <UploadTab onUploaded={onUploaded} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={onInsert} disabled={!selected}>
            Use selected image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GalleryTab({
  images,
  loadError,
  selected,
  onSelect,
  onDelete,
}: {
  images: StudioImage[] | null
  loadError: string | null
  selected: string | null
  onSelect: (url: string) => void
  onDelete: (id: string) => void
}) {
  if (loadError) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Could not load the media library: {loadError}
      </div>
    )
  }
  if (images === null) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    )
  }
  if (images.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No images uploaded yet. Switch to the Upload tab to add your first one.
      </div>
    )
  }

  return (
    <ScrollArea className="h-[360px] pr-3">
      <div className="grid grid-cols-3 gap-3">
        {images.map((img) => {
          const isSelected = selected === img.s3Url
          return (
            <button
              type="button"
              key={img.id}
              onClick={() => onSelect(img.s3Url)}
              className={cn(
                "group relative overflow-hidden rounded-md border bg-muted text-left transition-colors",
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "hover:border-foreground/30"
              )}
            >
              <div className="aspect-square w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.s3Url}
                  alt={img.alt || img.filename}
                  className="size-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium">{img.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(img.sizeBytes / 1024).toFixed(0)} KB
                </p>
              </div>
              {isSelected ? (
                <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-4"
                  />
                </span>
              ) : null}
              <span
                role="button"
                tabIndex={0}
                className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Delete image"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const ok = window.confirm(`Delete ${img.filename}?`)
                  if (!ok) return
                  const res = await fetch(`/api/images/${img.id}`, {
                    method: "DELETE",
                  })
                  if (!res.ok) {
                    toast.error("Could not delete image")
                    return
                  }
                  toast.success("Image deleted")
                  onDelete(img.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    ;(e.currentTarget as HTMLElement).click()
                  }
                }}
              >
                <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
              </span>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function UploadTab({ onUploaded }: { onUploaded: (image: StudioImage) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadDimensions(
    file: File
  ): Promise<{ width?: number; height?: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({})
      }
      img.src = url
    })
  }

  async function uploadWithProgress(
    url: string,
    file: File
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", url)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed with ${xhr.status}`))
      })
      xhr.addEventListener("error", () => reject(new Error("Upload failed")))
      xhr.send(file)
    })
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setProgress(0)
    try {
      const dims = await loadDimensions(file)

      const presignRes = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          alt: alt || undefined,
        }),
      })
      if (!presignRes.ok) {
        const err = (await presignRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(err.error ?? `Presign failed with ${presignRes.status}`)
      }
      const { image, uploadUrl } = (await presignRes.json()) as {
        image: StudioImage
        uploadUrl: string
      }

      await uploadWithProgress(uploadUrl, file)

      const finalizeRes = await fetch(`/api/images/${image.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: dims.width,
          height: dims.height,
          alt: alt || undefined,
          sizeBytes: file.size,
        }),
      })
      if (!finalizeRes.ok) {
        const err = (await finalizeRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(err.error ?? `Finalize failed with ${finalizeRes.status}`)
      }
      const { image: finalized } = (await finalizeRes.json()) as {
        image: StudioImage
      }
      onUploaded(finalized)
      setFile(null)
      setAlt("")
      if (inputRef.current) inputRef.current.value = ""
      toast.success("Image uploaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="media-upload-file">Image file</Label>
        <Input
          id="media-upload-file"
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Max 25 MB. PNG, JPEG, WebP, GIF, AVIF, or SVG.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="media-upload-alt">Alt text</Label>
        <Input
          id="media-upload-alt"
          value={alt}
          placeholder="Describe the image for accessibility."
          onChange={(e) => setAlt(e.target.value)}
        />
      </div>

      {file ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          {uploading ? (
            <Badge variant="secondary">{progress}%</Badge>
          ) : (
            <Button size="sm" onClick={handleUpload}>
              Upload to S3
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

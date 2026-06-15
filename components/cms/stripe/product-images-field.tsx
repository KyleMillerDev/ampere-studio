"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Upload01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StudioImage } from "@/lib/cms/images"
import { STRIPE_MAX_IMAGES } from "@/lib/validation/stripe-product.schema"

interface ProductImagesFieldProps {
  images: string[]
  onChange: (images: string[]) => void
}

/**
 * Manages the Stripe product `images` URL list: upload through the existing
 * presigned S3 flow, remove, and drag to rearrange. The first image is the
 * product's primary image in Stripe.
 */
export function ProductImagesField({
  images,
  onChange,
}: ProductImagesFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = images.indexOf(String(active.id))
    const to = images.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onChange(arrayMove(images, from, to))
  }

  async function uploadWithProgress(url: string, file: File): Promise<void> {
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

  async function handleFileChange(file: File | null) {
    if (!file) return
    if (images.length >= STRIPE_MAX_IMAGES) {
      toast.error(`Stripe allows at most ${STRIPE_MAX_IMAGES} images`)
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      const presignRes = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
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
        body: JSON.stringify({ sizeBytes: file.size }),
      })
      if (!finalizeRes.ok) {
        throw new Error(`Finalize failed with ${finalizeRes.status}`)
      }
      onChange([...images, image.s3Url])
      toast.success("Image uploaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((url, index) => (
                <SortableImage
                  key={url}
                  url={url}
                  isPrimary={index === 0}
                  onRemove={() => onChange(images.filter((u) => u !== url))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No images yet. Upload up to {STRIPE_MAX_IMAGES}; the first one is the
          primary image.
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || images.length >= STRIPE_MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
        >
          <HugeiconsIcon icon={Upload01Icon} className="mr-1 size-4" />
          {uploading ? `Uploading ${progress}%` : "Upload image"}
        </Button>
        {images.length > 1 ? (
          <span className="text-xs text-muted-foreground">
            Drag images to rearrange. The first image is shown to customers
            first.
          </span>
        ) : null}
      </div>
    </div>
  )
}

function SortableImage({
  url,
  isPrimary,
  onRemove,
}: {
  url: string
  isPrimary: boolean
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group relative aspect-square cursor-grab overflow-hidden rounded-md border bg-muted",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        draggable={false}
      />
      {isPrimary ? (
        <Badge className="absolute bottom-1.5 left-1.5" variant="secondary">
          Primary
        </Badge>
      ) : null}
      <button
        type="button"
        aria-label="Remove image"
        className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-white"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove()
        }}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
    </div>
  )
}

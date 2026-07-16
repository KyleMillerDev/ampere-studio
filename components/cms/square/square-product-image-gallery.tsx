"use client"

import { useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CircleX, GripVertical, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { processProductImage } from "@/lib/cms/process-product-image"
import { uploadStudioImage } from "@/lib/cms/upload-studio-image"

type Props = {
  images: string[]
  onChange: (images: string[]) => void
  processingImage?: boolean
  disabled?: boolean
  maxImages?: number
}

function imageId(url: string, index: number): string {
  return `img-${index}-${url}`
}

function SortableImage({
  id,
  url,
  isCover,
  onRemove,
  disabled,
}: {
  id: string
  url: string
  isCover: boolean
  onRemove: () => void
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    touchAction: "none" as const,
  }

  if (isCover) {
    return (
      <div ref={setNodeRef} style={style} className="group relative col-span-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Product cover"
          className="aspect-square w-full rounded-md object-cover transition-all duration-100 ease-in-out group-hover:opacity-25"
          src={url}
        />
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 cursor-grab rounded bg-background/70 p-1 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4 text-foreground" />
        </button>
        {!disabled && (
          <button
            type="button"
            className="absolute top-2 right-2 hidden rounded bg-background/70 p-1 group-hover:flex"
            onClick={onRemove}
          >
            <CircleX className="size-5 transition-colors hover:text-red-600" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Product"
        className="aspect-square w-full rounded-md object-cover transition-all duration-100 ease-in-out group-hover:opacity-25"
        height={84}
        src={url}
        width={84}
      />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 cursor-grab rounded bg-background/70 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-3 text-foreground" />
      </button>
      {!disabled && (
        <button
          type="button"
          className="absolute top-0 right-0 hidden group-hover:block"
          onClick={onRemove}
        >
          <CircleX className="transition-all duration-100 ease-in-out hover:text-red-600" />
        </button>
      )}
    </div>
  )
}

export function SquareProductImageGallery({
  images,
  onChange,
  processingImage: processingImageProp = false,
  disabled = false,
  maxImages = 50,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const processingImage = processingImageProp || uploading
  const ids = images.map((url, index) => imageId(url, index))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    })
  )

  function handleUploadClick() {
    if (disabled || processingImage) return
    inputRef.current?.click()
  }

  async function handleFileChanged(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    const remaining = maxImages - images.length
    if (remaining <= 0) {
      toast.error(`Maximum ${maxImages} images allowed`)
      return
    }

    const selected = files.slice(0, remaining)
    setUploading(true)

    try {
      const processed = await Promise.all(
        selected.map((file) => processProductImage(file))
      )
      const uploaded = await Promise.all(
        processed.map((file) => uploadStudioImage(file))
      )
      onChange([...images, ...uploaded.map((image) => image.s3Url)])
      toast.success(
        uploaded.length === 1
          ? "Image uploaded"
          : `${uploaded.length} images uploaded`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    onChange(arrayMove(images, oldIndex, newIndex))
  }

  const activeImage =
    activeId !== null ? images[ids.indexOf(activeId)] : undefined

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg"
        multiple
        onChange={handleFileChanged}
      />

      {images.length === 0 ? (
        <div className="aspect-square w-full rounded-md object-cover">
          <button
            type="button"
            disabled={disabled || processingImage}
            className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed"
            onClick={handleUploadClick}
          >
            {processingImage ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="sr-only">Upload</span>
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, index) => (
                <SortableImage
                  key={ids[index]}
                  id={ids[index]}
                  url={url}
                  isCover={index === 0}
                  onRemove={() =>
                    onChange(images.filter((item) => item !== url))
                  }
                  disabled={disabled}
                />
              ))}
              {images.length < maxImages && (
                <button
                  type="button"
                  className="group flex aspect-square w-full items-center justify-center rounded-md border border-dashed hover:border-foreground"
                  onClick={handleUploadClick}
                  disabled={disabled || processingImage}
                >
                  {processingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  )}
                  <span className="sr-only">Upload</span>
                </button>
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImage}
                alt="Dragging"
                className="aspect-square w-full rounded-md object-cover opacity-90 shadow-xl ring-2 ring-primary"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

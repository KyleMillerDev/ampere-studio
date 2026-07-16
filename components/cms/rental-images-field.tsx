"use client"

import { useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  DragDropVerticalIcon,
  ImageUploadIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadStudioImage } from "@/lib/cms/upload-studio-image"
import { cn } from "@/lib/utils"

interface SortableImageRowProps {
  url: string
  index: number
  onRemove: (url: string) => void
}

function SortableImageRow({ url, index, onRemove }: SortableImageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-2",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} className="size-4" />
      </button>

      {/* Thumbnail */}
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Image ${index + 1}`}
          className="size-full object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = "none"
          }}
        />
      </div>

      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {index === 0 && (
          <span className="mr-1 rounded bg-primary px-1 py-0.5 text-xs text-primary-foreground">
            Primary
          </span>
        )}{" "}
        {url}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(url)}
        aria-label="Remove image"
      >
        <HugeiconsIcon
          icon={Delete02Icon}
          className="size-4 text-destructive"
        />
      </Button>
    </div>
  )
}

interface RentalImagesFieldProps {
  value: string[]
  onChange: (urls: string[]) => void
}

export function RentalImagesField({ value, onChange }: RentalImagesFieldProps) {
  const [urlInput, setUrlInput] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = value.indexOf(String(active.id))
      const newIndex = value.indexOf(String(over.id))
      onChange(arrayMove(value, oldIndex, newIndex))
    }
  }

  function addUrl() {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    if (value.includes(trimmed)) {
      toast.error("That URL is already in the list.")
      return
    }
    onChange([...value, trimmed])
    setUrlInput("")
  }

  function removeUrl(url: string) {
    onChange(value.filter((u) => u !== url))
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setIsUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const image = await uploadStudioImage(file)
        uploaded.push(image.s3Url)
      }
      onChange([...value, ...uploaded])
      toast.success(
        uploaded.length === 1
          ? "Image uploaded"
          : `${uploaded.length} images uploaded`
      )
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={value} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {value.map((url, i) => (
                <SortableImageRow
                  key={url}
                  url={url}
                  index={i}
                  onRemove={removeUrl}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Paste URL */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={LinkSquare02Icon}
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-8"
            placeholder="Paste image URL and press Add"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addUrl()
              }
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={addUrl}>
          Add
        </Button>
      </div>

      {/* File upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={handleFileChange}
          id="rental-image-upload"
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <HugeiconsIcon icon={ImageUploadIcon} className="mr-2 size-4" />
          {isUploading ? "Uploading..." : "Upload image files"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag rows to reorder. The first image is the primary thumbnail.
      </p>
    </div>
  )
}

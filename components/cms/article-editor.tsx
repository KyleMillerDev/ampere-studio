"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Image01Icon,
  CheckmarkCircle01Icon,
  SparklesIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StudioImage } from "@/lib/cms/images"
import {
  titleToSlug,
  type ArticleWithBody,
} from "@/lib/validation/article.schema"
import { isAiArticlePaymentBypassed } from "@/lib/cms/ai-billing"
import {
  insertTextAtCursor,
  markdownImageSnippet,
  uploadStudioImage,
} from "@/lib/cms/upload-studio-image"

const devPaymentBypass = isAiArticlePaymentBypassed()

interface ArticleEditorProps {
  initial?: ArticleWithBody
}

export function ArticleEditor({ initial }: ArticleEditorProps) {
  const router = useRouter()
  const isEdit = Boolean(initial)

  const [title, setTitle] = useState(initial?.title ?? "")
  const [slug, setSlug] = useState(initial?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "")
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status ?? "draft"
  )
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(initial?.aiGenerated ?? false)
  const [aiModel, setAiModel] = useState(initial?.aiModel ?? "")
  const [paidAt, setPaidAt] = useState(initial?.paidAt ?? "")
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [writeConfirmOpen, setWriteConfirmOpen] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(titleToSlug(title))
    }
  }, [title, slugTouched])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get("checkout")
    const sessionId = params.get("session_id")
    const articleId = initial?.id

    if (checkout === "cancel") {
      toast.info("Payment cancelled. Your article is still saved as a draft.")
      window.history.replaceState({}, "", window.location.pathname)
      return
    }

    if (checkout === "success" && sessionId && articleId) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/articles/${articleId}/confirm-payment`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            }
          )
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string
            }
            throw new Error(err.error ?? "Payment confirmation failed")
          }
          const data = (await res.json()) as { article: ArticleWithBody }
          setStatus(data.article.status)
          setPaidAt(data.article.paidAt ?? "")
          toast.success("Payment complete. Article published.")
          window.history.replaceState({}, "", window.location.pathname)
          router.refresh()
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Payment confirmation failed"
          )
        }
      })()
    }
  }, [initial?.id, router])

  async function startCheckout(articleId: string) {
    const res = await fetch(`/api/articles/${articleId}/checkout`, {
      method: "POST",
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error ?? "Could not start checkout")
    }
    const data = (await res.json()) as { url: string }
    window.location.href = data.url
  }

  async function fetchTitleSuggestions() {
    setLoadingSuggestions(true)
    try {
      const query = title.trim()
        ? `?seed=${encodeURIComponent(title.trim())}`
        : ""
      const res = await fetch(`/api/articles/title-suggestions${query}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Could not load suggestions")
      }
      const data = (await res.json()) as { suggestions: string[] }
      setTitleSuggestions(data.suggestions)
      if (data.suggestions.length === 0) {
        toast.error("No title suggestions returned")
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load suggestions"
      )
    } finally {
      setLoadingSuggestions(false)
    }
  }

  async function handleWriteForMe() {
    if (!title.trim()) {
      toast.error("Enter a title before generating an article")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch("/api/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Generation failed")
      }
      const data = (await res.json()) as { body: string; model: string }
      setBody(data.body)
      setAiGenerated(true)
      setAiModel(data.model)
      setStatus("draft")
      toast.success("Article generated. Review and edit before publishing.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not generate article"
      )
    } finally {
      setGenerating(false)
      setWriteConfirmOpen(false)
    }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true)
    try {
      const image = await uploadStudioImage(file, title.trim() || file.name)
      const snippet = markdownImageSnippet(
        image.s3Url,
        image.alt || title.trim() || "Image"
      )
      if (bodyRef.current) {
        setBody(insertTextAtCursor(bodyRef.current, body, snippet))
      } else {
        setBody((prev) => prev + snippet)
      }
      toast.success("Image uploaded and added to the article")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed")
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!slug.trim()) {
      toast.error("Slug is required")
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        body,
        status,
        aiGenerated,
        aiModel: aiModel || undefined,
      }

      const url = isEdit ? `/api/articles/${initial!.id}` : "/api/articles"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => ({}))) as {
        article?: ArticleWithBody
        error?: string
        requiresPayment?: boolean
      }

      if (res.status === 402 && data.requiresPayment && data.article) {
        toast.info("Payment required to publish this AI article ($4.99).")
        await startCheckout(data.article.id)
        return
      }

      if (!res.ok) {
        throw new Error(data.error ?? `Save failed with ${res.status}`)
      }

      toast.success(isEdit ? "Article saved" : "Article created")

      if (!isEdit && data.article) {
        router.push(`/articles/${data.article.id}`)
        if (data.article.excerpt && !excerpt.trim()) {
          setExcerpt(data.article.excerpt)
        }
      } else {
        if (data.article?.excerpt && !excerpt.trim()) {
          setExcerpt(data.article.excerpt)
        }
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save article")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {aiGenerated && !paidAt && !devPaymentBypass ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Badge variant="secondary" className="mr-2">
            AI generated
          </Badge>
          This article will be billed $4.99 when you publish it. You can edit
          freely until then at no charge.
        </div>
      ) : aiGenerated && devPaymentBypass ? (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <Badge variant="secondary" className="mr-2">
            AI generated
          </Badge>
          Development mode: publish without payment.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Article details</CardTitle>
          <CardDescription>
            Title, slug, and metadata stored in the content table. The markdown
            body is saved to S3 as an .mdx file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="article-title">Title</Label>
              <div className="flex gap-2">
                <Input
                  id="article-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchTitleSuggestions}
                  disabled={loadingSuggestions}
                >
                  <HugeiconsIcon icon={SparklesIcon} className="mr-1 size-4" />
                  {loadingSuggestions ? "..." : "Suggest titles"}
                </Button>
              </div>
              {titleSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {titleSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setTitle(suggestion)
                        if (!slugTouched) setSlug(titleToSlug(suggestion))
                      }}
                      className="rounded-full border bg-muted px-3 py-1 text-left text-xs transition-colors hover:border-foreground/30 hover:bg-muted/80"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-slug">Slug</Label>
              <Input
                id="article-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                placeholder="article-slug"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="article-excerpt">Excerpt</Label>
            <Textarea
              id="article-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary for listings. Leave blank to auto-generate when you publish."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="article-thumbnail">Thumbnail URL</Label>
            <div className="flex gap-2">
              <Input
                id="article-thumbnail"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickerOpen(true)}
              >
                <HugeiconsIcon icon={Image01Icon} className="mr-1 size-4" />
                Library
              </Button>
            </div>
            {thumbnailUrl ? (
              <div className="mt-2 overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  className="h-32 w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="article-status">Published</Label>
              <p className="text-xs text-muted-foreground">
                Draft articles are hidden from the public site.
                {aiGenerated && !paidAt && !devPaymentBypass
                  ? " AI articles require a $4.99 payment at publish time."
                  : null}
              </p>
            </div>
            <Switch
              id="article-status"
              checked={status === "published"}
              onCheckedChange={(checked) =>
                setStatus(checked ? "published" : "draft")
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Markdown</CardTitle>
              <CardDescription>
                Write your article content here.
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImageUpload(file)
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
              >
                <HugeiconsIcon icon={Upload01Icon} className="mr-1 size-4" />
                {uploadingImage ? "Uploading..." : "Upload image"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWriteConfirmOpen(true)}
                disabled={generating}
              >
                <HugeiconsIcon icon={SparklesIcon} className="mr-1 size-4" />
                {generating ? "Writing..." : "Write for me ($4.99)"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="# Your article title&#10;&#10;Start writing..."
              className="min-h-[480px] font-mono text-sm"
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Live rendered preview of your markdown.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ScrollArea className="h-[480px] rounded-md border p-4">
              <article className="article-preview text-sm">
                {body.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {body}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Start typing to see a preview.
                  </p>
                )}
              </article>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/articles">Back to articles</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create article"}
        </Button>
      </div>

      <ThumbnailPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(url) => {
          setThumbnailUrl(url)
          setPickerOpen(false)
        }}
      />

      <AlertDialog open={writeConfirmOpen} onOpenChange={setWriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Write article with AI?</AlertDialogTitle>
            <AlertDialogDescription>
              Ampere will generate a full draft using your title and client
              industry. You are not charged now. A one-time fee of $4.99 is
              billed only when you publish this article.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWriteForMe} disabled={generating}>
              {generating ? "Generating..." : "Generate draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ThumbnailPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
}) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose thumbnail</DialogTitle>
          <DialogDescription>
            Pick an image from your media library for the article thumbnail.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Could not load the media library: {loadError}
          </div>
        ) : images === null ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No images uploaded yet. Upload images from the content editor media
            library first.
          </div>
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="grid grid-cols-3 gap-3">
              {images.map((img) => {
                const isSelected = selected === img.s3Url
                return (
                  <button
                    type="button"
                    key={img.id}
                    onClick={() => setSelected(img.s3Url)}
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
                      <p className="truncate text-xs font-medium">
                        {img.filename}
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
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selected) onSelect(selected)
            }}
            disabled={!selected}
          >
            Use selected image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

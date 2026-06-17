"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { StudioImage } from "@/lib/cms/images"

type MediaGenerateRequest = {
  source: "media"
  prompt: string
  alt?: string
}

type ArticleGenerateRequest = {
  source: "article"
  title: string
  body: string
  alt?: string
}

type GenerateRequest = MediaGenerateRequest | ArticleGenerateRequest

interface AiImageGeneratePanelProps {
  mode: "media" | "article"
  articleTitle?: string
  articleBody?: string
  onGenerated: (image: StudioImage) => void
  compact?: boolean
}

export function AiImageGeneratePanel({
  mode,
  articleTitle = "",
  articleBody = "",
  onGenerated,
  compact = false,
}: AiImageGeneratePanelProps) {
  const [prompt, setPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  async function handleGenerate() {
    if (mode === "media" && !prompt.trim()) {
      toast.error("Describe the image you want to generate")
      return
    }
    if (mode === "article" && !articleTitle.trim()) {
      toast.error("Enter an article title before generating a thumbnail")
      return
    }
    if (mode === "article" && !articleBody.trim()) {
      toast.error("Add article content before generating a thumbnail")
      return
    }

    setGenerating(true)
    setPreviewUrl(null)
    try {
      const payload: GenerateRequest =
        mode === "media"
          ? {
              source: "media",
              prompt: prompt.trim(),
              alt: prompt.trim().slice(0, 120) || undefined,
            }
          : {
              source: "article",
              title: articleTitle.trim(),
              body: articleBody,
              alt: articleTitle.trim() || undefined,
            }

      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Image generation failed")
      }

      const data = (await res.json()) as { image: StudioImage }
      setPreviewUrl(data.image.s3Url)
      onGenerated(data.image)
      toast.success("Image generated and saved to your media library")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not generate image"
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {mode === "media" ? (
        <div className="space-y-2">
          <Label htmlFor="ai-image-prompt">Describe your image</Label>
          <Textarea
            id="ai-image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A warm photo of a couple walking through an Iowa vineyard at golden hour..."
            rows={compact ? 3 : 4}
          />
          <p className="text-xs text-muted-foreground">
            Ampere rewrites your idea into a stronger image prompt, then
            generates a 1024x1024 graphic and saves it to your media library.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ampere reads your article title and body, writes a thumbnail prompt,
          generates a 1024x1024 image, and saves it to your media library.
        </p>
      )}

      <Button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className={compact ? "w-full" : undefined}
      >
        <HugeiconsIcon icon={SparklesIcon} className="mr-1 size-4" />
        {generating ? "Generating..." : "Generate image"}
      </Button>

      {previewUrl ? (
        <div className="overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Generated preview"
            className="aspect-square w-full object-cover"
          />
        </div>
      ) : null}
    </div>
  )
}

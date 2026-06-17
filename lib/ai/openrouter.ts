import { OpenRouter } from "@openrouter/sdk"

import {
  ARTICLE_STYLE_INSTRUCTIONS,
  IMAGE_PROMPT_INSTRUCTIONS,
  articleGenerationPrompt,
  articleThumbnailPromptRewrite,
  excerptGenerationPrompt,
  mediaImagePromptRewrite,
  titleSuggestionsPrompt,
} from "@/lib/ai/prompts"

const DEFAULT_MODEL = "~anthropic/claude-sonnet-latest"
const DEFAULT_EXCERPT_MODEL = "openai/gpt-4o-mini"
const DEFAULT_IMAGE_PROMPT_MODEL = "~anthropic/claude-sonnet-latest"
const IMAGE_GENERATION_MODEL = "openai/gpt-5.4-image-2"
const GENERATED_IMAGE_SIZE = "1024x1024"
const GENERATED_IMAGE_QUALITY = "medium"

let client: OpenRouter | null = null

export function getArticleModel(): string {
  return process.env.OPENROUTER_ARTICLE_MODEL?.trim() || DEFAULT_MODEL
}

export function getExcerptModel(): string {
  return process.env.OPENROUTER_EXCERPT_MODEL?.trim() || DEFAULT_EXCERPT_MODEL
}

export function getImagePromptModel(): string {
  return (
    process.env.OPENROUTER_IMAGE_PROMPT_MODEL?.trim() ||
    DEFAULT_IMAGE_PROMPT_MODEL
  )
}

export function getImageGenerationModel(): string {
  return (
    process.env.OPENROUTER_IMAGE_GENERATION_MODEL?.trim() ||
    IMAGE_GENERATION_MODEL
  )
}

function stripMarkdownForExcerpt(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000)
}

function stripMarkdownForImagePrompt(markdown: string): string {
  return stripMarkdownForExcerpt(markdown).slice(0, 2500)
}

type GeneratedImageMessage = {
  images?: Array<{
    image_url?: { url?: string }
    imageUrl?: { url?: string }
  }>
}

function extractGeneratedImageUrl(
  message: GeneratedImageMessage
): string | null {
  for (const image of message.images ?? []) {
    const url = image.image_url?.url ?? image.imageUrl?.url
    if (url) return url
  }
  return null
}

function getOpenRouter(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }
  if (!client) {
    client = new OpenRouter({ apiKey })
  }
  return client
}

function parseTitleSuggestions(text: string): string[] {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error("Could not parse title suggestions from AI response")
  }
  const parsed = JSON.parse(jsonMatch[0]) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error("Title suggestions response was not an array")
  }
  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5)
}

export async function suggestArticleTitles(params: {
  company: string
  industry: string
  topic?: string
}): Promise<string[]> {
  const openrouter = getOpenRouter()
  const result = openrouter.callModel({
    model: getArticleModel(),
    instructions: ARTICLE_STYLE_INSTRUCTIONS,
    input: titleSuggestionsPrompt(params),
    temperature: 0.8,
    maxOutputTokens: 512,
  })
  const text = await result.getText()
  const titles = parseTitleSuggestions(text)
  if (titles.length === 0) {
    throw new Error("No title suggestions were returned")
  }
  return titles
}

export async function generateArticle(params: {
  company: string
  industry: string
  title: string
}): Promise<{ body: string; model: string }> {
  const openrouter = getOpenRouter()
  const model = getArticleModel()
  const result = openrouter.callModel({
    model,
    instructions: ARTICLE_STYLE_INSTRUCTIONS,
    input: articleGenerationPrompt(params),
    temperature: 0.7,
    maxOutputTokens: 4096,
  })
  const body = (await result.getText()).trim()
  if (!body) {
    throw new Error("AI returned an empty article")
  }
  return { body, model }
}

export async function generateArticleExcerpt(params: {
  title: string
  body: string
}): Promise<string> {
  const openrouter = getOpenRouter()
  const bodyText = stripMarkdownForExcerpt(params.body)
  if (!bodyText) {
    return params.title.trim().slice(0, 200)
  }

  const result = openrouter.callModel({
    model: getExcerptModel(),
    input: excerptGenerationPrompt({ title: params.title, bodyText }),
    temperature: 0.5,
    maxOutputTokens: 120,
  })
  const text = (await result.getText()).trim().replace(/^["']|["']$/g, "")
  if (!text) {
    return params.title.trim().slice(0, 200)
  }
  return text.slice(0, 2000)
}

export async function rewriteMediaImagePrompt(
  userText: string
): Promise<string> {
  const openrouter = getOpenRouter()
  const result = openrouter.callModel({
    model: getImagePromptModel(),
    instructions: IMAGE_PROMPT_INSTRUCTIONS,
    input: mediaImagePromptRewrite(userText),
    temperature: 0.7,
    maxOutputTokens: 512,
  })
  const prompt = (await result.getText()).trim().replace(/^["']|["']$/g, "")
  if (!prompt) {
    throw new Error("Could not rewrite the image prompt")
  }
  return prompt
}

export async function rewriteArticleThumbnailPrompt(params: {
  title: string
  body: string
}): Promise<string> {
  const openrouter = getOpenRouter()
  const bodyText = stripMarkdownForImagePrompt(params.body)
  const result = openrouter.callModel({
    model: getImagePromptModel(),
    instructions: IMAGE_PROMPT_INSTRUCTIONS,
    input: articleThumbnailPromptRewrite({
      title: params.title,
      bodyText: bodyText || params.title,
    }),
    temperature: 0.7,
    maxOutputTokens: 512,
  })
  const prompt = (await result.getText()).trim().replace(/^["']|["']$/g, "")
  if (!prompt) {
    throw new Error("Could not write a thumbnail prompt for this article")
  }
  return prompt
}

export async function generateImageFromPrompt(
  prompt: string
): Promise<{ imageUrl: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const model = getImageGenerationModel()
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: "1:1",
      },
      size: GENERATED_IMAGE_SIZE,
      quality: GENERATED_IMAGE_QUALITY,
    }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    throw new Error(
      err.error?.message ?? `Image generation failed with ${res.status}`
    )
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: GeneratedImageMessage }>
  }
  const message = data.choices?.[0]?.message
  const imageUrl = message ? extractGeneratedImageUrl(message) : null
  if (!imageUrl) {
    throw new Error("Image generation returned no image")
  }

  return { imageUrl, model }
}

export async function generateStudioImageFromMediaPrompt(params: {
  userText: string
  alt?: string
}): Promise<{ prompt: string; imageUrl: string; model: string }> {
  const prompt = await rewriteMediaImagePrompt(params.userText)
  const generated = await generateImageFromPrompt(prompt)
  return { prompt, ...generated }
}

export async function generateStudioImageForArticle(params: {
  title: string
  body: string
}): Promise<{ prompt: string; imageUrl: string; model: string }> {
  const prompt = await rewriteArticleThumbnailPrompt(params)
  const generated = await generateImageFromPrompt(prompt)
  return { prompt, ...generated }
}

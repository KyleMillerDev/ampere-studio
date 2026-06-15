import { OpenRouter } from "@openrouter/sdk"

import {
  ARTICLE_STYLE_INSTRUCTIONS,
  articleGenerationPrompt,
  excerptGenerationPrompt,
  titleSuggestionsPrompt,
} from "@/lib/ai/prompts"

const DEFAULT_MODEL = "~anthropic/claude-sonnet-latest"
const DEFAULT_EXCERPT_MODEL = "openai/gpt-4o-mini"

let client: OpenRouter | null = null

export function getArticleModel(): string {
  return process.env.OPENROUTER_ARTICLE_MODEL?.trim() || DEFAULT_MODEL
}

export function getExcerptModel(): string {
  return process.env.OPENROUTER_EXCERPT_MODEL?.trim() || DEFAULT_EXCERPT_MODEL
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

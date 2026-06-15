import { OpenRouter } from "@openrouter/sdk"

import {
  ARTICLE_STYLE_INSTRUCTIONS,
  articleGenerationPrompt,
  titleSuggestionsPrompt,
} from "@/lib/ai/prompts"

const DEFAULT_MODEL = "~anthropic/claude-sonnet-latest"

let client: OpenRouter | null = null

export function getArticleModel(): string {
  return process.env.OPENROUTER_ARTICLE_MODEL?.trim() || DEFAULT_MODEL
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

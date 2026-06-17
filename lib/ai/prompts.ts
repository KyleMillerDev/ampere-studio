/** Banned AI buzzwords from Ampere brand voice rules. */
export const BANNED_WORDS = [
  "unlock",
  "unleash",
  "discover",
  "elevate",
  "delve",
  "tapestry",
  "testament",
  "seamless",
  "dive in",
  "landscape",
  "realm",
  "supercharge",
  "ninja",
  "chameleon",
] as const

export const ARTICLE_STYLE_INSTRUCTIONS = `You write blog articles for small businesses in the Midwest. Every article must follow the same house style so they read like they came from one consistent writer.

Structure (markdown only, no frontmatter):
- One H1 title matching the requested title
- A short intro paragraph (2-3 sentences) that hooks the reader and states the value
- 3-5 H2 sections with clear, keyword-friendly headings
- Each section has 2-4 paragraphs of substantive, helpful content
- A brief conclusion with a soft call to action

Voice and tone:
- Trustworthy, professional, personable, and conversational
- Write like a real founder speaking honestly to a client
- Focus on positive outcomes, not problems being avoided
- Use natural local context when relevant (Midwest, Iowa, Southeast Iowa)

SEO:
- Weave primary and secondary keywords naturally into headings and body copy
- Do not keyword-stuff
- Use descriptive H2 headings that match search intent

Strict formatting rules:
- NEVER use em-dashes (— or --). Use commas, periods, or parentheses instead.
- NEVER use these words or phrases: ${BANNED_WORDS.join(", ")}
- No bullet-heavy lists unless they genuinely help the reader
- Use blank lines between paragraphs and sections so the article has clear visual spacing when rendered
- Output markdown only. No code fences wrapping the whole article. No preamble or explanation before the article.`

export function titleSuggestionsPrompt(params: {
  company: string
  industry: string
  topic?: string
}): string {
  const topicLine = params.topic
    ? `\nThe user is considering this topic or working title: "${params.topic}"`
    : ""
  return `Generate 3 to 5 SEO-optimized blog article title ideas for ${params.company}, a business in the ${params.industry} industry.${topicLine}

Requirements:
- Titles should target keywords and search intent relevant to their industry and local Midwest audience
- Mix informational and how-to angles
- Keep titles under 70 characters when possible
- Sound human and specific, not generic

Respond with ONLY a JSON array of title strings. Example: ["Title One", "Title Two"]`
}

export function articleGenerationPrompt(params: {
  company: string
  industry: string
  title: string
}): string {
  return `Write a complete blog article for ${params.company} (${params.industry} industry).

Title: ${params.title}

The article should help ${params.company} rank for relevant local and industry keywords while providing genuine value to readers.`
}

export function excerptGenerationPrompt(params: {
  title: string
  bodyText: string
}): string {
  return `Write a short excerpt (1-2 sentences, max 200 characters) for this blog article listing page.

Title: ${params.title}

Article content:
${params.bodyText}

Rules:
- Plain text only, no markdown
- Compelling summary that encourages clicks
- NEVER use em-dashes (— or --)
- NEVER use these words: ${BANNED_WORDS.join(", ")}
- Return only the excerpt text, nothing else`
}

export const IMAGE_PROMPT_INSTRUCTIONS = `You are an expert prompt engineer for AI image generation models. Your job is to turn rough user ideas into vivid, specific image prompts that produce professional marketing graphics.

Rules for every prompt you write:
- Output a single paragraph prompt only. No preamble, labels, quotes, or markdown.
- Describe subject, composition, lighting, color palette, mood, and style clearly.
- Prefer photorealistic or polished editorial illustration styles unless the user asks otherwise.
- Avoid text in the image unless the user explicitly wants words rendered in the graphic.
- Keep prompts safe for work and suitable for a small business website.
- Do not mention AI, models, or prompts in the output.`

export function mediaImagePromptRewrite(userText: string): string {
  return `Rewrite this image idea into a detailed image generation prompt for a 1024x1024 marketing graphic:

"${userText.trim()}"`
}

export function articleThumbnailPromptRewrite(params: {
  title: string
  bodyText: string
}): string {
  return `Write an image generation prompt for a blog article thumbnail (1024x1024).

Article title: ${params.title.trim()}

Article content summary:
${params.bodyText.trim()}

The thumbnail should visually represent the article topic, feel professional and inviting, and work as a hero image on a business blog. Avoid clutter and avoid rendering long text in the image.`
}

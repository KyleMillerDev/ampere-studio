import { z } from "zod"

const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers, and hyphens"
  )

export const articleCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  slug: slugSchema,
  status: z.enum(["draft", "published"]).default("draft"),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  excerpt: z.string().max(2000).default(""),
  body: z.string().default(""),
  publishedAt: z.string().datetime().optional(),
  aiGenerated: z.boolean().default(false),
  paidAt: z.string().datetime().optional(),
  aiModel: z.string().max(200).optional(),
})

export const articleUpdateSchema = articleCreateSchema.partial()

export type ArticleFormInput = z.input<typeof articleCreateSchema>
export type ArticleCreateInput = z.output<typeof articleCreateSchema>
export type ArticleUpdateInput = z.output<typeof articleUpdateSchema>

export interface Article extends Omit<ArticleCreateInput, "body"> {
  id: string
  client_id: string
  s3Key: string
  createdAt: string
  updatedAt: string
}

export interface ArticleWithBody extends Article {
  body: string
}

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

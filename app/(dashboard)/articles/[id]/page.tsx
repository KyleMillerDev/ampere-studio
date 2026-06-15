import { notFound } from "next/navigation"

import { PageHeading } from "@/components/cms/page-heading"
import { ArticleEditor } from "@/components/cms/article-editor"
import { getArticle } from "@/lib/cms/articles"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const article = await getArticle(id)
  return { title: article ? `Edit: ${article.title}` : "Article not found" }
}

export default async function EditArticlePage({ params }: Props) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) notFound()

  return (
    <div className="space-y-6">
      <PageHeading
        title={article.title}
        description={`Editing /${article.slug}.mdx`}
      />
      <ArticleEditor initial={article} />
    </div>
  )
}

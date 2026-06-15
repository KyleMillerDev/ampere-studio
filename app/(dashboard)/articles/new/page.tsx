import { PageHeading } from "@/components/cms/page-heading"
import { ArticleEditor } from "@/components/cms/article-editor"

export const metadata = { title: "New article" }
export const dynamic = "force-dynamic"

export default function NewArticlePage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="New article"
        description="Write a new article. Save as draft or publish when ready."
      />
      <ArticleEditor />
    </div>
  )
}

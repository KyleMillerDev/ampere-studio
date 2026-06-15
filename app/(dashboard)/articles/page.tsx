import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"

import { PageHeading } from "@/components/cms/page-heading"
import { ArticlesTable } from "@/components/cms/articles-table"
import { Button } from "@/components/ui/button"
import { listArticles } from "@/lib/cms/articles"

export const metadata = { title: "Articles" }
export const dynamic = "force-dynamic"

export default async function ArticlesPage() {
  const articles = await listArticles().catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Articles"
        description="Manage blog posts and articles stored as .mdx files in S3."
        actions={
          <Button asChild>
            <Link href="/articles/new">
              <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
              New article
            </Link>
          </Button>
        }
      />
      <ArticlesTable articles={articles} />
    </div>
  )
}

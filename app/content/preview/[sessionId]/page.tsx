import Script from "next/script"
import { notFound } from "next/navigation"

import { getSession } from "@/lib/editor/session"
import { BlockRenderer } from "@/components/cms/editor/block-renderer"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Props = { params: Promise<{ sessionId: string }> }

/**
 * The iframe target for the visual editor. Renders all editable blocks
 * captured by the parser, then loads the inject script that wires up
 * contenteditable + postMessage forwarding to the parent window.
 */
export default async function EditorPreviewPage({ params }: Props) {
  const { sessionId } = await params
  const session = getSession(sessionId)
  if (!session) notFound()

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 border-b pb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Ampere Studio preview
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {session.owner}/{session.name}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            on {session.ref}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit text inline. Click an image to swap it from your media library.
          Changes queue on the right until you click Publish.
        </p>
      </header>

      <BlockRenderer blocks={session.blocks} />

      <Script src="/editor/inject.js" strategy="afterInteractive" />
    </div>
  )
}

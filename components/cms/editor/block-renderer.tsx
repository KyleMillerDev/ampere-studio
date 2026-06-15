import type { EditorBlock } from "@/lib/editor/types"

interface BlockRendererProps {
  blocks: EditorBlock[]
}

const TEXT_SAFE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "button",
  "caption",
  "div",
  "em",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "label",
  "li",
  "p",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "summary",
  "td",
  "th",
])

/**
 * Render every editable block inline in the preview iframe. The renderer
 * intentionally maps custom components to labeled placeholders so we never
 * execute arbitrary client code from the fetched repository.
 */
export function BlockRenderer({ blocks }: BlockRendererProps) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No editable blocks found. Add <code>data-ampere-id</code> or{" "}
        <code>data-ampere-json</code> attributes to your JSX and refetch the repo.
      </div>
    )
  }

  const sorted = [...blocks].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6">
      {sorted.map((block) => (
        <Block key={block.blockId} block={block} />
      ))}
    </div>
  )
}

function Block({ block }: { block: EditorBlock }) {
  const commonAttrs: Record<string, string> = {
    "data-ampere-block-id": block.blockId,
    "data-ampere-block-type": block.type,
  }
  if (block.sourceType === "inline") {
    commonAttrs["data-ampere-id"] = block.targetId
  } else {
    commonAttrs["data-ampere-json"] = block.targetId
  }

  const className = block.classNameValue

  if (block.type === "image") {
    return (
      <figure className="space-y-2">
        <BlockLabel block={block} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...commonAttrs}
          src={block.initialValue || "/placeholder-image.svg"}
          alt=""
          className={className ?? "w-full max-w-xl rounded-md border bg-muted"}
        />
      </figure>
    )
  }

  // Text blocks: render using the original intrinsic tag when it is HTML-safe.
  const tag = TEXT_SAFE_TAGS.has(block.jsxTag.toLowerCase())
    ? (block.jsxTag.toLowerCase() as keyof React.JSX.IntrinsicElements)
    : ("p" as const)
  const Element = tag as unknown as React.ElementType

  return (
    <section className="space-y-2">
      <BlockLabel block={block} />
      <Element {...commonAttrs} className={className}>
        {block.initialValue || " "}
      </Element>
    </section>
  )
}

function BlockLabel({ block }: { block: EditorBlock }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span
        className="rounded bg-muted px-2 py-0.5 font-mono"
        title={block.filePath}
      >
        {block.sourceType === "json"
          ? `${block.jsonFile} : ${block.jsonKeyPath}`
          : block.targetId}
      </span>
      <span className="rounded border px-2 py-0.5 font-mono">
        {block.jsxTag}
      </span>
      <span
        className={
          block.sourceType === "json"
            ? "rounded bg-blue-100 px-2 py-0.5 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
            : "rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
        }
      >
        {block.sourceType}
      </span>
    </div>
  )
}

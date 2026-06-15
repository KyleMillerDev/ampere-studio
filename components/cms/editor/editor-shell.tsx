"use client"

import { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EditorStoreProvider,
  type EditorSessionMeta,
} from "@/components/cms/editor/editor-store"
import { EditorIframe } from "@/components/cms/editor/editor-iframe"
import { EditorInspector } from "@/components/cms/editor/editor-inspector"
import { ImagePickerDialog } from "@/components/cms/editor/image-picker-dialog"
import type { EditorBlock } from "@/lib/editor/types"

export type Viewport = "desktop" | "mobile"

interface EditorShellProps {
  session: EditorSessionMeta
  counts: { blocks: number; files: number }
  warnings: Array<{ targetId: string; reason: string }>
}

interface PageOption {
  label: string
  path: string
}

function derivePages(blocks: EditorBlock[]): PageOption[] {
  const seen = new Set<string>()
  const pages: PageOption[] = []

  for (const block of blocks) {
    const fp = block.filePath
    if (seen.has(fp) || !/page\.(tsx?|jsx?)$/.test(fp)) continue
    seen.add(fp)

    let route = fp
      .replace(/^src\//, "")
      .replace(/^app\//, "")
      .replace(/(^|\/)page\.(tsx?|jsx?)$/, "")
      .replace(/\([^)]+\)\//g, "")

    const path = route === "" || route === fp ? "/" : `/${route}`
    const label =
      path === "/"
        ? "Home"
        : path
            .replace(/^\//, "")
            .split("/")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" / ")

    pages.push({ label, path })
  }

  return pages.length > 0 ? pages : [{ label: "Home", path: "/" }]
}

export function EditorShell({ session }: EditorShellProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const pages = useMemo(() => derivePages(session.blocks), [session.blocks])
  const [activePath, setActivePath] = useState(pages[0]?.path ?? "/")

  return (
    <EditorStoreProvider session={session}>
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Slim header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card px-3">
          <Select value={activePath} onValueChange={setActivePath}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.path} value={p.path} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-0.5">
            <Button
              variant={viewport === "desktop" ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              aria-label="Desktop view"
              onClick={() => setViewport("desktop")}
            >
              <HugeiconsIcon icon={ComputerIcon} className="size-4" />
            </Button>
            <Button
              variant={viewport === "mobile" ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              aria-label="Mobile view"
              onClick={() => setViewport("mobile")}
            >
              <HugeiconsIcon icon={SmartPhone01Icon} className="size-4" />
            </Button>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex flex-1 overflow-hidden">
          <EditorIframe
            sessionId={session.sessionId}
            siteUrl={session.siteUrl}
            viewport={viewport}
            activePath={activePath}
          />
          <EditorInspector />
        </div>
      </div>

      <ImagePickerDialog />
    </EditorStoreProvider>
  )
}

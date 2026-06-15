"use client"

import { useEffect, useMemo, useState } from "react"

import { useEditorStore } from "@/components/cms/editor/editor-store"
import type { Viewport } from "@/components/cms/editor/editor-shell"

interface EditorIframeProps {
  sessionId: string
  siteUrl?: string
  viewport: Viewport
  activePath: string
}

const MESSAGE_SIGNATURE = "ampere-studio-editor"

type IncomingMessage =
  | {
      signature: typeof MESSAGE_SIGNATURE
      kind: "change"
      blockId: string
      targetId: string
      sourceType: "inline" | "json"
      type: "text"
      newValue: string
    }
  | {
      signature: typeof MESSAGE_SIGNATURE
      kind: "open-media"
      blockId: string
      targetId: string
      sourceType: "inline" | "json"
    }
  | {
      signature: typeof MESSAGE_SIGNATURE
      kind: "ready"
      count: number
    }

export function EditorIframe({ sessionId, siteUrl, viewport, activePath }: EditorIframeProps) {
  const { state, dispatch, iframeRef } = useEditorStore()
  const [ready, setReady] = useState(false)

  const src = useMemo(() => {
    const encodedSession = encodeURIComponent(sessionId)
    if (siteUrl) {
      const encodedPath = encodeURIComponent(activePath)
      return `/api/editor/live-preview?sessionId=${encodedSession}&path=${encodedPath}`
    }
    return `/content/preview/${encodedSession}`
  }, [sessionId, siteUrl, activePath])

  useEffect(() => {
    setReady(false)
    const timer = window.setTimeout(() => setReady(true), 6000)
    return () => window.clearTimeout(timer)
  }, [src])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as IncomingMessage | undefined
      if (!data || data.signature !== MESSAGE_SIGNATURE) return

      if (data.kind === "ready") {
        setReady(true)
        return
      }

      if (data.kind === "change" && data.type === "text") {
        const initialBlock = state.session.blocks.find(
          (b) => b.blockId === data.blockId
        )
        // Only do the "revert to original" check when we have the initial value.
        // Elements not in the block cache (e.g. headings with inline children or
        // expression children that the parser skipped) still get tracked.
        if (initialBlock && initialBlock.initialValue === data.newValue) {
          dispatch({ type: "remove-change", blockId: data.blockId })
          return
        }
        dispatch({
          type: "upsert-change",
          change: {
            blockId: data.blockId,
            targetId: data.targetId,
            sourceType: data.sourceType,
            type: "text",
            newValue: data.newValue,
          },
        })
        return
      }

      if (data.kind === "open-media") {
        dispatch({
          type: "open-media",
          blockId: data.blockId,
          targetId: data.targetId,
        })
        return
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [state.session.blocks, dispatch])

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-3">
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-xs text-muted-foreground">
          Loading preview...
        </div>
      ) : null}
      <div
        className="relative h-full overflow-hidden rounded-lg border bg-background shadow-sm transition-[width] duration-300"
        style={{ width: viewport === "mobile" ? "390px" : "100%" }}
      >
        <iframe
          ref={iframeRef}
          src={src}
          title={siteUrl ? "Live site preview" : "Ampere Studio parsed preview"}
          className="h-full min-h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  )
}

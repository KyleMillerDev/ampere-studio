"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { EditorShell } from "@/components/cms/editor/editor-shell"
import type { EditorBlock } from "@/lib/editor/types"

interface ActiveSession {
  sessionId: string
  owner: string
  name: string
  ref: string
  siteUrl?: string
  blocks: EditorBlock[]
  counts: { blocks: number; files: number }
}

type FetchState = "loading" | "error" | "ready"

export function EditorLanding() {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [warnings, setWarnings] = useState<Array<{ targetId: string; reason: string }>>([])
  const [fetchState, setFetchState] = useState<FetchState>("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")

  const fetchConfiguredRepo = useCallback(async () => {
    setFetchState("loading")
    setErrorMessage("")
    try {
      const res = await fetch("/api/editor/fetch-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setErrorMessage(err.error ?? "Could not load the site content.")
        setFetchState("error")
        return
      }
      const data = (await res.json()) as {
        session: {
          sessionId: string
          owner: string
          name: string
          ref: string
          siteUrl?: string
          blocks: EditorBlock[]
        }
        counts: { blocks: number; files: number }
        warnings?: Array<{ targetId: string; reason: string }>
        fromCache?: boolean
      }
      setSession({
        sessionId: data.session.sessionId,
        owner: data.session.owner,
        name: data.session.name,
        ref: data.session.ref,
        siteUrl: data.session.siteUrl,
        blocks: data.session.blocks,
        counts: data.counts,
      })
      setWarnings(data.warnings ?? [])
      setFetchState("ready")
      if (!data.fromCache) {
        const blocks = data.counts.blocks
        toast.success(`Ready. ${blocks.toLocaleString()} editable block${blocks === 1 ? "" : "s"} found.`)
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.")
      setFetchState("error")
    }
  }, [])

  useEffect(() => {
    fetchConfiguredRepo()
  }, [fetchConfiguredRepo])

  if (fetchState === "ready" && session) {
    return (
      <EditorShell
        session={{
          sessionId: session.sessionId,
          owner: session.owner,
          name: session.name,
          ref: session.ref,
          siteUrl: session.siteUrl,
          blocks: session.blocks,
        }}
        counts={session.counts}
        warnings={warnings}
      />
    )
  }

  if (fetchState === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
        <Button variant="outline" size="sm" onClick={fetchConfiguredRepo}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <style>{`
        @keyframes ampere-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
      <div className="relative h-0.5 w-56 overflow-hidden rounded-full bg-border">
        <div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary"
          style={{ animation: "ampere-slide 1.6s ease-in-out infinite" }}
        />
      </div>
      <p className="text-sm text-muted-foreground">Loading your site content&hellip;</p>
    </div>
  )
}

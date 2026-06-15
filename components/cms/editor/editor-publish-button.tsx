"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useEditorStore } from "@/components/cms/editor/editor-store"

export function EditorPublishButton() {
  const { state, dispatch } = useEditorStore()
  const count = Object.keys(state.changes).length

  async function onPublish() {
    if (count === 0) return
    dispatch({ type: "set-publishing", value: true })
    try {
      const res = await fetch("/api/editor/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.session.sessionId,
          changes: Object.values(state.changes),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        branch?: string
        commitUrl?: string
        warnings?: Array<{ targetId: string; reason: string }>
        error?: string
      }
      if (!res.ok || !data.ok) {
        dispatch({
          type: "set-last-publish",
          value: {
            ok: false,
            error: data.error ?? `Server returned ${res.status}`,
          },
        })
        toast.error(data.error ?? "Publish failed")
        return
      }
      dispatch({
        type: "set-last-publish",
        value: {
          ok: true,
          branch: data.branch,
          commitUrl: data.commitUrl,
          warnings: data.warnings,
        },
      })
      dispatch({ type: "clear-changes" })
      toast.success(
        `Published ${count} change${count === 1 ? "" : "s"} to ${data.branch ?? "review branch"}.`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown network error"
      dispatch({ type: "set-last-publish", value: { ok: false, error: msg } })
      toast.error(msg)
    } finally {
      dispatch({ type: "set-publishing", value: false })
    }
  }

  return (
    <Button
      size="sm"
      onClick={onPublish}
      disabled={count === 0 || state.publishing}
    >
      {state.publishing
        ? "Publishing..."
        : count === 0
          ? "No changes"
          : `Publish ${count} change${count === 1 ? "" : "s"}`}
    </Button>
  )
}

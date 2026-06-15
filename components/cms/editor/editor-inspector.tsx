"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useEditorStore } from "@/components/cms/editor/editor-store"
import { EditorPublishButton } from "@/components/cms/editor/editor-publish-button"
import { truncate } from "@/lib/utils"

export function EditorInspector() {
  const { state, dispatch, pushValue } = useEditorStore()
  const blockMap = new Map(state.session.blocks.map((b) => [b.blockId, b]))

  const changes = Object.values(state.changes)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 border-r bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pending changes</h2>
        {changes.length > 0 && (
          <Badge variant="default">{changes.length} {changes.length === 1 ? "change" : "changes"}</Badge>
        )}
      </div>

      <ScrollArea className="flex-1 rounded-md border">
        <div className="space-y-2 p-2">
          {changes.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              Click any text or image in the preview to start editing.
            </div>
          ) : (
            changes.map((change) => {
              const block = blockMap.get(change.blockId)
              if (!block) return null
              return (
                <div
                  key={change.blockId}
                  className="flex flex-col gap-1 rounded-md border p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-xs font-medium">
                        {truncate(change.newValue, 80)}
                      </p>
                      {block.initialValue ? (
                        <p className="truncate text-[11px] text-muted-foreground line-through">
                          {truncate(block.initialValue, 80)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0"
                      aria-label="Revert"
                      onClick={() => {
                        dispatch({
                          type: "remove-change",
                          blockId: change.blockId,
                        })
                        pushValue(
                          change.blockId,
                          change.type,
                          block.initialValue
                        )
                      }}
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {state.lastPublish ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-medium">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
            Changes published
          </div>
          {state.lastPublish.commitUrl ? (
            <a
              href={state.lastPublish.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate underline"
            >
              View on GitHub
            </a>
          ) : null}
        </div>
      ) : null}

      <EditorPublishButton />
    </aside>
  )
}

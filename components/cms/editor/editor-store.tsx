"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
} from "react"

import type { EditorBlock, EditorChange } from "@/lib/editor/types"

export interface EditorSessionMeta {
  sessionId: string
  owner: string
  name: string
  ref: string
  siteUrl?: string
  blocks: EditorBlock[]
}

export interface EditorState {
  session: EditorSessionMeta
  /** Map of blockId to the most recent pending change. */
  changes: Record<string, EditorChange>
  publishing: boolean
  lastPublish?: {
    ok: boolean
    branch?: string
    commitUrl?: string
    warnings?: Array<{ targetId: string; reason: string }>
    error?: string
  }
  mediaPicker: { open: boolean; blockId?: string; targetId?: string }
}

type Action =
  | { type: "upsert-change"; change: EditorChange }
  | { type: "remove-change"; blockId: string }
  | { type: "clear-changes" }
  | { type: "set-publishing"; value: boolean }
  | { type: "set-last-publish"; value: EditorState["lastPublish"] }
  | { type: "open-media"; blockId: string; targetId: string }
  | { type: "close-media" }

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "upsert-change": {
      const next = { ...state.changes, [action.change.blockId]: action.change }
      return { ...state, changes: next }
    }
    case "remove-change": {
      if (!state.changes[action.blockId]) return state
      const next = { ...state.changes }
      delete next[action.blockId]
      return { ...state, changes: next }
    }
    case "clear-changes":
      return { ...state, changes: {} }
    case "set-publishing":
      return { ...state, publishing: action.value }
    case "set-last-publish":
      return { ...state, lastPublish: action.value }
    case "open-media":
      return {
        ...state,
        mediaPicker: {
          open: true,
          blockId: action.blockId,
          targetId: action.targetId,
        },
      }
    case "close-media":
      return { ...state, mediaPicker: { open: false } }
    default:
      return state
  }
}

interface EditorStoreContextValue {
  state: EditorState
  dispatch: Dispatch<Action>
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>
  pushValue(
    blockId: string,
    type: "text" | "image",
    newValue: string
  ): void
}

const EditorStoreContext = createContext<EditorStoreContextValue | null>(null)

interface EditorStoreProviderProps {
  session: EditorSessionMeta
  children: React.ReactNode
}

export function EditorStoreProvider({
  session,
  children,
}: EditorStoreProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    session,
    changes: {},
    publishing: false,
    mediaPicker: { open: false },
  })
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const pushValue = useCallback(
    (blockId: string, type: "text" | "image", newValue: string) => {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      try {
        const fn = (win as unknown as Window).__ampereSetValue
        if (typeof fn === "function") {
          fn(blockId, type, newValue)
        }
      } catch {
        // Cross-origin attempts will throw; the iframe is always same-origin in MVP.
      }
    },
    []
  )

  const value = useMemo(
    () => ({ state, dispatch, iframeRef, pushValue }),
    [state, pushValue]
  )

  return (
    <EditorStoreContext.Provider value={value}>
      {children}
    </EditorStoreContext.Provider>
  )
}

export function useEditorStore(): EditorStoreContextValue {
  const ctx = useContext(EditorStoreContext)
  if (!ctx) {
    throw new Error("useEditorStore must be used inside EditorStoreProvider")
  }
  return ctx
}

/**
 * Script injected into the /content/preview iframe.
 *
 * Responsibilities:
 *   1. Scan the DOM for elements marked as editable.
 *   2. Make text-editable nodes `contenteditable` and wire up input listeners.
 *   3. Forward edits to the parent window via `postMessage`.
 *   4. Let the parent push updates back in via `window.__ampereSetValue`.
 *
 * Built as an IIFE bundle targeting modern browsers. No external imports;
 * everything lives in this file so the output is a single static asset.
 */

type EditorSourceType = "inline" | "json"
type EditorBlockType = "text" | "image"

interface AmpereBlockMapEntry {
  blockId: string
  targetId: string
  type: EditorBlockType
  sourceType: EditorSourceType
}

interface ChangeMessage {
  kind: "change"
  blockId: string
  targetId: string
  sourceType: EditorSourceType
  type: "text"
  newValue: string
}

interface OpenMediaMessage {
  kind: "open-media"
  blockId: string
  targetId: string
  sourceType: EditorSourceType
}

interface ReadyMessage {
  kind: "ready"
  count: number
}

type OutboundMessage = ChangeMessage | OpenMediaMessage | ReadyMessage

export {}

const SIGNATURE = "ampere-studio-editor"
const EDITABLE_SELECTOR =
  "[data-ampere-block-id], [data-ampere-id], [data-ampere-json]"
const TEXT_CLASS = "ampere-editable"
const HOVER_CLASS = "ampere-editable-hover"
const IMAGE_CLASS = "ampere-editable-image"

// Brand blue; hardcoded hex so the styles work on any host site regardless of
// whether it defines --primary as a CSS custom property.
const ACCENT = "#2563eb"
const ACCENT_TINT = "rgba(37, 99, 235, 0.12)"
const ACCENT_SELECTION = "rgba(37, 99, 235, 0.35)"

function post(msg: OutboundMessage): void {
  const payload = { signature: SIGNATURE, ...msg }
  window.parent.postMessage(payload, window.location.origin)
}

function injectStyles(): void {
  const style = document.createElement("style")
  style.setAttribute("data-ampere-editor-style", "true")
  style.textContent = `
    .${TEXT_CLASS} {
      outline: 1px dashed transparent;
      outline-offset: 2px;
      transition: outline-color 0.12s ease-in-out, background-color 0.12s ease-in-out;
      cursor: text !important;
      caret-color: ${ACCENT} !important;
    }
    .${TEXT_CLASS} *,
    .${TEXT_CLASS} *::before,
    .${TEXT_CLASS} *::after {
      cursor: text !important;
    }
    .${TEXT_CLASS}:hover,
    .${HOVER_CLASS} {
      outline-color: ${ACCENT} !important;
      background-color: ${ACCENT_TINT} !important;
    }
    .${TEXT_CLASS}[contenteditable="true"]:focus,
    .${TEXT_CLASS}[contenteditable="true"]:focus-visible {
      outline: 2px solid ${ACCENT} !important;
      outline-offset: 2px !important;
      background-color: ${ACCENT_TINT} !important;
    }
    .${TEXT_CLASS}::selection,
    .${TEXT_CLASS} ::selection {
      background-color: ${ACCENT_SELECTION} !important;
      color: inherit !important;
    }
    .${IMAGE_CLASS} {
      outline: 2px dashed transparent;
      outline-offset: 2px;
      transition: outline-color 0.12s ease-in-out, background-color 0.12s ease-in-out, box-shadow 0.12s ease-in-out;
      cursor: pointer !important;
    }
    .${IMAGE_CLASS}:hover,
    .${IMAGE_CLASS}:focus,
    .${IMAGE_CLASS}:focus-visible {
      outline-color: ${ACCENT} !important;
      background-color: ${ACCENT_TINT} !important;
      box-shadow: inset 0 0 0 9999px ${ACCENT_TINT} !important;
    }
  `
  document.head.appendChild(style)
}

/**
 * Return the editable type for an element. Any element whose block map entry
 * says `container` (or any other non-editable value from a legacy cache) is
 * returned as null so no hover outline or click handler is attached.
 */
function readBlockType(el: HTMLElement): EditorBlockType | null {
  // Layout containers are never directly editable. Skip them
  // so they don't pick up the text cursor or background highlight.
  if (["section", "nav", "header"].includes(el.tagName.toLowerCase())) return null

  const value = el.getAttribute("data-ampere-block-type")
  if (value === "text") return "text"
  if (value === "image") return "image"
  if (value === null || value === "") {
    // No server-assigned type: fall back to tag-based detection for plain
    // `<img data-ampere-id>` or simple text-only elements.
    if (el.tagName.toLowerCase() === "img") return "image"
    if (
      el.hasAttribute("data-ampere-id") ||
      el.hasAttribute("data-ampere-json")
    ) {
      return "text"
    }
  }
  // Anything else (e.g., legacy "container") is intentionally skipped.
  return null
}

function readSourceType(el: HTMLElement): EditorSourceType {
  return el.hasAttribute("data-ampere-json") ? "json" : "inline"
}

function readTargetId(el: HTMLElement): string {
  return (
    el.getAttribute("data-ampere-json") ??
    el.getAttribute("data-ampere-id") ??
    ""
  )
}

function attachText(el: HTMLElement, blockId: string): void {
  el.classList.add(TEXT_CLASS)
  el.setAttribute("contenteditable", "true")
  el.setAttribute("spellcheck", "true")

  let lastValue = el.textContent ?? ""

  const onInput = () => {
    const current = el.textContent ?? ""
    if (current === lastValue) return
    lastValue = current
    post({
      kind: "change",
      blockId,
      targetId: readTargetId(el),
      sourceType: readSourceType(el),
      type: "text",
      newValue: current,
    })
  }

  el.addEventListener("input", onInput)
  el.addEventListener("focus", () => el.classList.add(HOVER_CLASS))
  el.addEventListener("blur", () => {
    el.classList.remove(HOVER_CLASS)
    onInput()
  })
}

function attachImage(el: HTMLElement, blockId: string): void {
  el.classList.add(IMAGE_CLASS)
  el.setAttribute("tabindex", "0")

  const openPicker = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    post({
      kind: "open-media",
      blockId,
      targetId: readTargetId(el),
      sourceType: readSourceType(el),
    })
  }

  el.addEventListener("click", openPicker)
  el.addEventListener("keydown", (ev) => {
    if (ev instanceof KeyboardEvent && (ev.key === "Enter" || ev.key === " ")) {
      openPicker(ev)
    }
  })
}

function init(): void {
  injectStyles()

  const blockMap = getBlockMap()
  const editables = Array.from(
    document.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)
  )

  let interactive = 0
  for (const el of editables) {
    const targetId = readTargetId(el)
    const mapped = targetId ? blockMap.get(targetId) : undefined
    const blockId =
      el.getAttribute("data-ampere-block-id") ?? mapped?.blockId ?? targetId
    if (!blockId) continue
    el.setAttribute("data-ampere-block-id", blockId)
    if (!el.hasAttribute("data-ampere-block-type") && mapped?.type) {
      el.setAttribute("data-ampere-block-type", mapped.type)
    }
    const type = readBlockType(el)
    if (type === "text") {
      attachText(el, blockId)
      interactive += 1
    } else if (type === "image") {
      attachImage(el, blockId)
      interactive += 1
    }
    // Everything else is silently skipped (no outline, no cursor, no click).
  }

  ;(
    window as unknown as {
      __ampereSetValue?: (
        blockId: string,
        type: EditorBlockType,
        newValue: string
      ) => void
    }
  ).__ampereSetValue = (
    blockId: string,
    type: EditorBlockType,
    newValue: string
  ) => {
    const el = document.querySelector<HTMLElement>(
      `[data-ampere-block-id="${CSS.escape(blockId)}"]`
    )
    if (!el) return

    if (type === "image") {
      if (el.tagName.toLowerCase() === "img") {
        ;(el as HTMLImageElement).src = newValue
      } else {
        el.setAttribute("data-ampere-src", newValue)
        el.style.backgroundImage = `url(${JSON.stringify(newValue)})`
      }
    } else if (type === "text") {
      el.textContent = newValue
    }
  }

  post({ kind: "ready", count: interactive })
}

function getBlockMap(): Map<string, AmpereBlockMapEntry> {
  const raw = (
    window as unknown as {
      __ampereBlockMap?: AmpereBlockMapEntry[]
    }
  ).__ampereBlockMap
  if (!Array.isArray(raw)) return new Map()
  return new Map(raw.map((entry) => [entry.targetId, entry]))
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}

"use client"

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

const LONG_HOVER_MS = 450
const CLOSE_DELAY_MS = 180
const POPUP_OFFSET = 14

function clampPopupPosition(
  x: number,
  y: number,
  width: number,
  height: number
) {
  const maxX = window.innerWidth - width - 12
  const maxY = window.innerHeight - height - 12
  return {
    left: Math.max(12, Math.min(x + POPUP_OFFSET, maxX)),
    top: Math.max(12, Math.min(y + POPUP_OFFSET, maxY)),
  }
}

interface CursorHoverPopupProps {
  children: ReactNode
  content: ReactNode
  label: string
  width?: number
  /** Reposition when expandable content changes height. */
  contentKey?: string | number | boolean
}

export function CursorHoverPopup({
  children,
  content,
  label,
  width = 300,
  contentKey,
}: CursorHoverPopupProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const mouseRef = useRef({ x: 0, y: 0 })
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open || !popupRef.current) return
    const { height } = popupRef.current.getBoundingClientRect()
    setCoords(
      clampPopupPosition(
        mouseRef.current.x,
        mouseRef.current.y,
        width,
        height
      )
    )
  }, [open, contentKey, width])

  function clearOpenTimer() {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function scheduleOpen() {
    clearOpenTimer()
    openTimerRef.current = window.setTimeout(() => {
      setCoords(
        clampPopupPosition(
          mouseRef.current.x,
          mouseRef.current.y,
          width,
          220
        )
      )
      setOpen(true)
      openTimerRef.current = null
    }, LONG_HOVER_MS)
  }

  function scheduleClose() {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, CLOSE_DELAY_MS)
  }

  function onTriggerEnter(e: MouseEvent) {
    clearCloseTimer()
    mouseRef.current = { x: e.clientX, y: e.clientY }
    if (!open) scheduleOpen()
  }

  function onTriggerMove(e: MouseEvent) {
    mouseRef.current = { x: e.clientX, y: e.clientY }
  }

  function onTriggerLeave() {
    clearOpenTimer()
    scheduleClose()
  }

  function onPopupEnter() {
    clearCloseTimer()
    clearOpenTimer()
  }

  function onPopupLeave() {
    scheduleClose()
  }

  return (
    <>
      <div
        onMouseEnter={onTriggerEnter}
        onMouseMove={onTriggerMove}
        onMouseLeave={onTriggerLeave}
      >
        {children}
      </div>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label={label}
            className="fixed z-50 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
            style={{ left: coords.left, top: coords.top, width }}
            onMouseEnter={onPopupEnter}
            onMouseLeave={onPopupLeave}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  )
}

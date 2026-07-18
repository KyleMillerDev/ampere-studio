import * as React from "react"

const HYSTERESIS_PX = 32
const MIN_CONTENT_WIDTH_PX = 360
const CHART_SETTLE_MS = 200

function readCssLengthPx(root: HTMLElement, value: string): number {
  const probe = document.createElement("div")
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${value}`
  root.appendChild(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width
}

function readSidebarWidthPx(wrapper: HTMLElement): number {
  const raw =
    getComputedStyle(wrapper).getPropertyValue("--sidebar-width").trim() ||
    "16rem"
  return readCssLengthPx(wrapper, raw)
}

function getDashboardContent(wrapper: HTMLElement): HTMLElement | null {
  return (
    wrapper.querySelector<HTMLElement>("[data-dashboard-content]") ??
    wrapper.querySelector<HTMLElement>("[data-slot=sidebar-inset]")
  )
}

/** Overflow caused only by Recharts nodes that have not resized to their parent yet. */
function isOnlyStaleChartOverflow(content: HTMLElement): boolean {
  if (content.scrollWidth <= content.clientWidth + 1) return false

  const charts = content.querySelectorAll<HTMLElement>(
    ".recharts-responsive-container"
  )
  if (charts.length === 0) return false

  const previousDisplay: string[] = []
  charts.forEach((chart, index) => {
    previousDisplay[index] = chart.style.display
    chart.style.display = "none"
  })

  const stillOverflows = content.scrollWidth > content.clientWidth + 1

  charts.forEach((chart, index) => {
    chart.style.display = previousDisplay[index] ?? ""
  })

  return !stillOverflows
}

function hasHorizontalOverflow(wrapper: HTMLElement): {
  overflows: boolean
  waitingOnCharts: boolean
} {
  const doc = document.documentElement
  if (doc.scrollWidth > doc.clientWidth + 1) {
    return { overflows: true, waitingOnCharts: false }
  }
  if (wrapper.scrollWidth > wrapper.clientWidth + 1) {
    return { overflows: true, waitingOnCharts: false }
  }

  const content = getDashboardContent(wrapper)
  if (content && content.scrollWidth > content.clientWidth + 1) {
    if (isOnlyStaleChartOverflow(content)) {
      return { overflows: false, waitingOnCharts: true }
    }
    return { overflows: true, waitingOnCharts: false }
  }

  return { overflows: false, waitingOnCharts: false }
}

/**
 * Compact (mobile bottom nav / sheet) when an open desktop sidebar would force
 * horizontal scrolling. Switches to the sidebar layout only once sidebar + page
 * content fit without overflow.
 */
export function useIsMobile(wrapper: HTMLElement | null) {
  // Prefer compact chrome until we can prove the sidebar layout fits.
  const [isMobile, setIsMobile] = React.useState(true)
  const failViewportRef = React.useRef(0)
  const chartSettleAttemptsRef = React.useRef(0)
  const [layoutKey, setLayoutKey] = React.useState(0)

  React.useEffect(() => {
    if (!wrapper) return

    const bump = () => setLayoutKey((value) => value + 1)
    const ro = new ResizeObserver(bump)

    ro.observe(wrapper)
    const inset = wrapper.querySelector("[data-slot=sidebar-inset]")
    if (inset) ro.observe(inset)
    const content = getDashboardContent(wrapper)
    if (content && content !== inset) ro.observe(content)

    window.addEventListener("resize", bump)
    bump()

    return () => {
      ro.disconnect()
      window.removeEventListener("resize", bump)
    }
  }, [wrapper])

  React.useLayoutEffect(() => {
    if (!wrapper) return

    const viewportWidth = window.innerWidth
    const sidebarWidth = readSidebarWidthPx(wrapper)
    const minDesktopWidth = sidebarWidth + MIN_CONTENT_WIDTH_PX

    if (isMobile) {
      chartSettleAttemptsRef.current = 0
      if (viewportWidth < minDesktopWidth) return
      if (
        failViewportRef.current > 0 &&
        viewportWidth < failViewportRef.current + HYSTERESIS_PX
      ) {
        return
      }

      // Try the sidebar layout; the desktop branch verifies it does not overflow.
      setIsMobile(false)
      return
    }

    const { overflows, waitingOnCharts } = hasHorizontalOverflow(wrapper)
    if (overflows) {
      chartSettleAttemptsRef.current = 0
      failViewportRef.current = Math.max(failViewportRef.current, viewportWidth)
      setIsMobile(true)
      return
    }

    if (waitingOnCharts) {
      if (chartSettleAttemptsRef.current >= 3) {
        chartSettleAttemptsRef.current = 0
        failViewportRef.current = Math.max(
          failViewportRef.current,
          viewportWidth
        )
        setIsMobile(true)
        return
      }

      chartSettleAttemptsRef.current += 1
      const timer = window.setTimeout(() => {
        setLayoutKey((value) => value + 1)
      }, CHART_SETTLE_MS)
      return () => window.clearTimeout(timer)
    }

    // Desktop layout fits.
    chartSettleAttemptsRef.current = 0
    failViewportRef.current = 0
  }, [wrapper, isMobile, layoutKey])

  return isMobile
}

"use client"

import { createContext, useContext } from "react"

import type { AnalyticsHelpAction } from "@/lib/analytics/types"

export type EducationActionHandler = (action: AnalyticsHelpAction) => void

const EducationActionsContext = createContext<EducationActionHandler | null>(
  null
)

export function EducationActionsProvider({
  onAction,
  children,
}: {
  onAction: EducationActionHandler
  children: React.ReactNode
}) {
  return (
    <EducationActionsContext.Provider value={onAction}>
      {children}
    </EducationActionsContext.Provider>
  )
}

/** Returns the dashboard education dispatcher, or null outside the provider. */
export function useEducationActions(): EducationActionHandler | null {
  return useContext(EducationActionsContext)
}

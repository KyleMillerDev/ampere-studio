"use client"

import { type ComponentType, type ReactElement, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export type EntityMenuItemProps = {
  className?: string
  onSelect?: (event: Event) => void
  asChild?: boolean
  disabled?: boolean
  variant?: "default" | "destructive"
  children?: ReactNode
}

export type EntityMenuSeparatorProps = {
  className?: string
}

export type EntityMenuParts = {
  Item: ComponentType<EntityMenuItemProps>
  Separator: ComponentType<EntityMenuSeparatorProps>
}

/** Touch-friendly class for rows that open a long-press context menu on mobile. */
export const entityContextTargetClass =
  "[-webkit-touch-callout:none] select-none"

interface EntityRowActionsProps {
  /** Shared menu body for both the 3-dot dropdown and right-click / long-press menu. */
  renderItems: (parts: EntityMenuParts) => ReactNode
  /**
   * Must return a single element that can take a ref (e.g. TableRow, Link, div).
   * Receives the optional 3-dot dropdown control to place in the row.
   */
  children: (dropdown: ReactNode) => ReactElement
  /** Optional second trigger (e.g. expanded table row). */
  expandedRow?: ReactElement | null
  onContextMenuOpenChange?: (open: boolean) => void
  /** Hide the 3-dot control when the surface is context-menu-only. */
  showDropdown?: boolean
  contentClassName?: string
  dropdownAriaLabel?: string
}

/**
 * Dual-menu pattern for dashboard entities: right-click / long-press context menu
 * plus an optional 3-dot dropdown that share the same actions.
 */
export function EntityRowActions({
  renderItems,
  children,
  expandedRow,
  onContextMenuOpenChange,
  showDropdown = true,
  contentClassName = "w-44",
  dropdownAriaLabel = "Actions",
}: EntityRowActionsProps) {
  const dropdown = showDropdown ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={dropdownAriaLabel}>
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        {renderItems({
          Item: DropdownMenuItem,
          Separator: DropdownMenuSeparator,
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  return (
    <ContextMenu onOpenChange={onContextMenuOpenChange}>
      <ContextMenuTrigger asChild>{children(dropdown)}</ContextMenuTrigger>
      {expandedRow ? (
        <ContextMenuTrigger asChild>{expandedRow}</ContextMenuTrigger>
      ) : null}
      <ContextMenuContent className={contentClassName}>
        {renderItems({
          Item: ContextMenuItem,
          Separator: ContextMenuSeparator,
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface EntityContextMenuProps {
  renderItems: (parts: EntityMenuParts) => ReactNode
  children: ReactElement
  onOpenChange?: (open: boolean) => void
  contentClassName?: string
}

/** Context-menu-only wrapper when a 3-dot control is not needed. */
export function EntityContextMenu({
  renderItems,
  children,
  onOpenChange,
  contentClassName = "w-44",
}: EntityContextMenuProps) {
  return (
    <EntityRowActions
      renderItems={renderItems}
      showDropdown={false}
      onContextMenuOpenChange={onOpenChange}
      contentClassName={contentClassName}
    >
      {() => children}
    </EntityRowActions>
  )
}

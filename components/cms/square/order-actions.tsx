"use client"

import type { ReactElement, ReactNode } from "react"
import Link from "next/link"

import {
  EntityContextMenu,
  EntityRowActions,
  type EntityMenuParts,
} from "@/components/cms/entity-row-actions"

export type SquareOrderActionTarget = {
  id: string
}

function SquareOrderMenuItems({
  order,
  Item,
}: {
  order: SquareOrderActionTarget
} & EntityMenuParts) {
  return (
    <>
      <Item asChild>
        <Link href={`/square/orders/${order.id}`}>View Order</Link>
      </Item>
      <Item asChild>
        <Link href={`/square/orders/${order.id}`} target="_blank">
          Open in new tab
        </Link>
      </Item>
    </>
  )
}

export function SquareOrderRowActions({
  order,
  children,
  onContextMenuOpenChange,
  showDropdown = true,
}: {
  order: SquareOrderActionTarget
  children: (dropdown: ReactNode) => ReactElement
  onContextMenuOpenChange?: (open: boolean) => void
  showDropdown?: boolean
}) {
  return (
    <EntityRowActions
      showDropdown={showDropdown}
      dropdownAriaLabel="Order actions"
      onContextMenuOpenChange={onContextMenuOpenChange}
      renderItems={(parts) => <SquareOrderMenuItems order={order} {...parts} />}
    >
      {children}
    </EntityRowActions>
  )
}

export function SquareOrderContextMenu({
  order,
  children,
}: {
  order: SquareOrderActionTarget
  children: ReactElement
}) {
  return (
    <EntityContextMenu
      renderItems={(parts) => <SquareOrderMenuItems order={order} {...parts} />}
    >
      {children}
    </EntityContextMenu>
  )
}

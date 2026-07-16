"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"

type DollarInputProps = {
  value?: number
  onChange: (cents: number | undefined) => void
  className?: string
  placeholder?: string
  allowEmpty?: boolean
  id?: string
}

export function DollarInput({
  value,
  onChange,
  className,
  placeholder = "0.00",
  allowEmpty = false,
  id,
}: DollarInputProps) {
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)

  const displayValue = focused
    ? draft
    : value !== undefined && value !== null
      ? (value / 100).toFixed(2)
      : ""

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={displayValue}
      onFocus={() => {
        setFocused(true)
        setDraft(
          value !== undefined && value !== null ? String(value / 100) : ""
        )
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const raw = draft.trim()
        if (raw === "") {
          onChange(allowEmpty ? undefined : 0)
          return
        }
        const dollars = parseFloat(raw)
        if (!Number.isNaN(dollars)) {
          onChange(Math.round(dollars * 100))
        }
      }}
    />
  )
}

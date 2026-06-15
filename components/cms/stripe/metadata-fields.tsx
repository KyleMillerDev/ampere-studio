"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { MetadataSuggestions } from "@/lib/validation/stripe-product.schema"

export interface MetadataRow {
  key: string
  value: string
  /** Rows seeded from existing products' metadata keys can't be renamed. */
  known: boolean
}

/** Build the initial row set: one optional row per known key, merged with existing values. */
export function buildMetadataRows(
  suggestions: MetadataSuggestions,
  existing: Record<string, string> = {}
): MetadataRow[] {
  const rows: MetadataRow[] = []
  const seen = new Set<string>()
  for (const key of Object.keys(suggestions).sort()) {
    rows.push({ key, value: existing[key] ?? "", known: true })
    seen.add(key)
  }
  for (const [key, value] of Object.entries(existing)) {
    if (!seen.has(key)) rows.push({ key, value, known: true })
  }
  return rows
}

function keyIsIdLike(key: string): boolean {
  return key.toLowerCase().includes("id")
}

interface MetadataFieldsProps {
  rows: MetadataRow[]
  onChange: (rows: MetadataRow[]) => void
  suggestions: MetadataSuggestions
}

/**
 * Editable metadata key/value rows. Keys discovered on other products show up
 * as optional fields with value autofill; custom rows can be added freely.
 */
export function MetadataFields({
  rows,
  onChange,
  suggestions,
}: MetadataFieldsProps) {
  function updateRow(index: number, patch: Partial<MetadataRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No other info fields yet. Add one to attach extra details to this
          product.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                value={row.key}
                readOnly={row.known}
                placeholder="Key"
                className={
                  row.known ? "max-w-[200px] bg-muted/50" : "max-w-[200px]"
                }
                onChange={(e) => updateRow(index, { key: e.target.value })}
              />
              <SuggestingValueInput
                value={row.value}
                onChange={(value) => updateRow(index, { value })}
                suggestions={
                  keyIsIdLike(row.key) ? [] : (suggestions[row.key] ?? [])
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove field"
                onClick={() => removeRow(index)}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...rows, { key: "", value: "", known: false }])
        }
      >
        <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
        Add field
      </Button>
    </div>
  )
}

/** Free-text input with a dropdown of values used on other products. */
function SuggestingValueInput({
  value,
  onChange,
  suggestions,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
}) {
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    if (suggestions.length === 0) return []
    const query = value.trim().toLowerCase()
    const filtered = query
      ? suggestions.filter(
          (s) => s.toLowerCase().includes(query) && s !== value
        )
      : suggestions
    return filtered.slice(0, 8)
  }, [suggestions, value])

  const showSuggestions = open && matches.length > 0

  return (
    <Popover open={showSuggestions}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          placeholder="Value (optional)"
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-48 overflow-y-auto">
          {matches.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(suggestion)
                setOpen(false)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

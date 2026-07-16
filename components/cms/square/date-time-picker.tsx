"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const STORAGE_FORMAT = "yyyy-MM-dd'T'HH:mm"

function parseDateTime(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, STORAGE_FORMAT, new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toStorageValue(date: Date): string {
  return format(date, STORAGE_FORMAT)
}

interface DateTimePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDateTime(value)

  function updateDate(date: Date | undefined) {
    if (!date) {
      onChange("")
      return
    }
    const current = selected ?? new Date()
    date.setHours(current.getHours(), current.getMinutes(), 0, 0)
    onChange(toStorageValue(date))
  }

  function updateTime(timeValue: string) {
    const [hours, minutes] = timeValue.split(":").map((part) => Number(part))
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return
    const next = selected ? new Date(selected) : new Date()
    next.setHours(hours, minutes, 0, 0)
    onChange(toStorageValue(next))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4" />
          {selected ? format(selected, "PPP p") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            updateDate(date)
            setOpen(false)
          }}
        />
        <div className="border-t p-3">
          <Label className="text-xs text-muted-foreground">Time</Label>
          <Input
            type="time"
            className="mt-1 h-8"
            value={selected ? format(selected, "HH:mm") : ""}
            onChange={(e) => updateTime(e.target.value)}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

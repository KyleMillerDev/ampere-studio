"use client"

import { useFormContext, useWatch } from "react-hook-form"

import { FormLabel } from "@/components/ui/form"
import {
  isRentalRequiredFieldSatisfied,
  type RentalRequiredField,
} from "@/lib/validation/rental-required-fields"
import type { RentalFormInput } from "@/lib/validation/rental.schema"
import { cn } from "@/lib/utils"

function RequiredMark({ satisfied }: { satisfied: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-0.5 font-normal transition-colors",
        satisfied
          ? "text-muted-foreground"
          : "text-red-900/55 dark:text-red-400/55"
      )}
    >
      *
    </span>
  )
}

export function RentalRequiredLabel({
  name,
  children,
  className,
}: {
  name: RentalRequiredField
  children: React.ReactNode
  className?: string
}) {
  const form = useFormContext<RentalFormInput>()
  const values = useWatch({ control: form.control }) as RentalFormInput
  const satisfied = isRentalRequiredFieldSatisfied(name, values)

  return (
    <FormLabel className={className}>
      {children}
      <RequiredMark satisfied={satisfied} />
    </FormLabel>
  )
}

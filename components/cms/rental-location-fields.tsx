"use client"

import { useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { RentalRequiredLabel } from "@/components/cms/rental-required-label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RENTAL_COUNTIES } from "@/lib/constants/rental-counties"
import { US_STATE_CODES } from "@/lib/constants/us-states"
import { loadGoogleMaps } from "@/lib/google/load-google-maps"
import { parseGooglePlace } from "@/lib/google/parse-google-place"
import type { RentalFormInput } from "@/lib/validation/rental.schema"
import { cn } from "@/lib/utils"

interface RentalLocationFieldsProps {
  form: UseFormReturn<RentalFormInput, unknown, RentalFormInput>
  mapsApiKey?: string
}

export function RentalLocationFields({
  form,
  mapsApiKey,
}: RentalLocationFieldsProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [countyOpen, setCountyOpen] = useState(false)
  const [mapsReady, setMapsReady] = useState(false)
  const [streetInput, setStreetInput] = useState<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!mapsApiKey) return

    let cancelled = false

    loadGoogleMaps(mapsApiKey)
      .then(() => {
        if (cancelled) return
        setMapsReady(true)
      })
      .catch(() => {
        if (!cancelled) setMapsReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [mapsApiKey])

  useEffect(() => {
    if (
      !mapsReady ||
      !streetInput ||
      !window.google?.maps?.places?.Autocomplete
    ) {
      return
    }

    const autocomplete = new window.google.maps.places.Autocomplete(
      streetInput,
      {
        componentRestrictions: { country: "us" },
        fields: ["address_components", "formatted_address", "geometry"],
        types: ["address"],
      }
    )

    autocompleteRef.current = autocomplete

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
      const parsed = parseGooglePlace(place)
      if (!parsed) return

      form.setValue("address.street", parsed.street, { shouldDirty: true })
      form.setValue("address.city", parsed.city, { shouldDirty: true })
      form.setValue("address.state", parsed.state, { shouldDirty: true })
      form.setValue("address.zip", parsed.zip, { shouldDirty: true })
      form.setValue("lat", parsed.lat, { shouldDirty: true })
      form.setValue("lng", parsed.lng, { shouldDirty: true })
      if (parsed.county) {
        form.setValue("county", parsed.county, {
          shouldDirty: true,
          shouldValidate: true,
        })
      } else {
        form.resetField("county")
      }
    })

    return () => {
      window.google?.maps?.event?.clearInstanceListeners(autocomplete)
      autocompleteRef.current = null
      listener.remove()
    }
  }, [form, mapsReady, streetInput])

  function markCoordinatesStale() {
    form.setValue("lat", 0, { shouldDirty: true })
    form.setValue("lng", 0, { shouldDirty: true })
  }

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="address.street"
        render={({ field }) => (
          <FormItem>
            <RentalRequiredLabel name="address.street">
              Street address
            </RentalRequiredLabel>
            <FormControl>
              <Input
                placeholder="Start typing an address…"
                autoComplete="off"
                {...field}
                ref={(node) => {
                  field.ref(node)
                  setStreetInput(node)
                }}
                onChange={(e) => {
                  markCoordinatesStale()
                  field.onChange(e)
                }}
              />
            </FormControl>
            {!mapsApiKey ? (
              <p className="text-xs text-muted-foreground">
                Address autocomplete is unavailable until{" "}
                <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
                is configured.
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <FormField
          control={form.control}
          name="address.city"
          render={({ field }) => (
            <FormItem>
              <RentalRequiredLabel name="address.city">
                City
              </RentalRequiredLabel>
              <FormControl>
                <Input
                  placeholder="Bloomfield"
                  {...field}
                  onChange={(e) => {
                    markCoordinatesStale()
                    field.onChange(e)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address.state"
          render={({ field }) => (
            <FormItem>
              <RentalRequiredLabel name="address.state">
                State
              </RentalRequiredLabel>
              <Select
                value={field.value || "IA"}
                onValueChange={(value) => {
                  markCoordinatesStale()
                  field.onChange(value)
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72">
                  {US_STATE_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address.zip"
          render={({ field }) => (
            <FormItem>
              <RentalRequiredLabel name="address.zip">
                ZIP
              </RentalRequiredLabel>
              <FormControl>
                <Input
                  placeholder="52537"
                  inputMode="numeric"
                  maxLength={10}
                  {...field}
                  onChange={(e) => {
                    markCoordinatesStale()
                    field.onChange(e)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="county"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <RentalRequiredLabel name="county">County</RentalRequiredLabel>
            <Popover open={countyOpen} onOpenChange={setCountyOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={countyOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? field.value : "Select county"}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search counties…" />
                  <CommandList>
                    <CommandEmpty>No county found.</CommandEmpty>
                    <CommandGroup>
                      {RENTAL_COUNTIES.map((county) => (
                        <CommandItem
                          key={county}
                          value={county}
                          onSelect={() => {
                            field.onChange(county)
                            setCountyOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              field.value === county
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {county}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

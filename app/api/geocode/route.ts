import { NextResponse } from "next/server"
import { z } from "zod"

import { geocodeAddress } from "@/lib/google/geocode-address"
import { getGoogleMapsApiKey } from "@/lib/google/maps-api-key"

export const dynamic = "force-dynamic"

const geocodeSchema = z.object({
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().min(1),
  }),
})

export async function POST(req: Request) {
  if (!getGoogleMapsApiKey()) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured" },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = geocodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 400 }
    )
  }

  const coords = await geocodeAddress(parsed.data.address)
  if (!coords) {
    return NextResponse.json(
      { error: "Could not find coordinates for this address" },
      { status: 404 }
    )
  }

  return NextResponse.json(coords)
}

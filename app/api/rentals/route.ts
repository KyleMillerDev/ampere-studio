import { NextResponse } from "next/server"
import { z } from "zod"

import { createRental, listRentals } from "@/lib/cms/rentals"
import {
  assertRentalsEnabled,
  RentalsDisabledError,
} from "@/lib/cms/rentals-access"
import { rentalCreateSchema } from "@/lib/validation/rental.schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await assertRentalsEnabled()
  } catch (err) {
    if (err instanceof RentalsDisabledError) {
      return NextResponse.json(
        { error: "Rentals not enabled" },
        { status: 403 }
      )
    }
    throw err
  }

  const rentals = await listRentals()
  return NextResponse.json({ rentals })
}

export async function POST(req: Request) {
  try {
    await assertRentalsEnabled()
  } catch (err) {
    if (err instanceof RentalsDisabledError) {
      return NextResponse.json(
        { error: "Rentals not enabled" },
        { status: 403 }
      )
    }
    throw err
  }

  const body = await req.json().catch(() => ({}))
  const parsed = rentalCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const rental = await createRental(parsed.data)
  return NextResponse.json({ rental }, { status: 201 })
}

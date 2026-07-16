import { NextResponse } from "next/server"
import { z } from "zod"

import { deleteRental, getRental, updateRental } from "@/lib/cms/rentals"
import {
  assertRentalsEnabled,
  RentalsDisabledError,
} from "@/lib/cms/rentals-access"
import { rentalUpdateSchema } from "@/lib/validation/rental.schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

async function checkEnabled() {
  try {
    await assertRentalsEnabled()
    return null
  } catch (err) {
    if (err instanceof RentalsDisabledError) {
      return NextResponse.json(
        { error: "Rentals not enabled" },
        { status: 403 }
      )
    }
    throw err
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await checkEnabled()
  if (guard) return guard

  const { id } = await params
  const rental = await getRental(id)
  if (!rental) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ rental })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await checkEnabled()
  if (guard) return guard

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = rentalUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const rental = await updateRental(id, parsed.data)
    if (!rental)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ rental })
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await checkEnabled()
  if (guard) return guard

  const { id } = await params
  await deleteRental(id)
  return NextResponse.json({ ok: true })
}

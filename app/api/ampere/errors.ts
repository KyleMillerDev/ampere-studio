import { NextResponse } from "next/server"

import {
  AmpereCatalogDisabledError,
  AmpereProductNotFoundError,
  AmpereValidationError,
} from "@/lib/ampere/products"

export function ampereErrorResponse(err: unknown): NextResponse {
  if (err instanceof AmpereCatalogDisabledError) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }
  if (err instanceof AmpereProductNotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (err instanceof AmpereValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? (err as { name?: string }).name
      : undefined
  if (name === "ConditionalCheckFailedException") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  throw err
}

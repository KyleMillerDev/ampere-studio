/**
 * CMS-only item-option preset templates.
 * These are stored in Ampere-Studio-Content (not in Square's catalog) and
 * can be loaded into the product builder as a starting option structure.
 * Previously named "modifier list presets" in kmcms (misleadingly).
 */

import { randomUUID } from "crypto"

import {
  deleteMirrorOptionPreset,
  getMirrorOptionPreset,
  listMirrorOptionPresets,
  optionPresetSK,
  putMirrorOptionPreset,
} from "@/lib/square/mirror"
import type { SquareOptionPreset } from "@/lib/square/types"
import { getActiveClientId } from "@/lib/cms/client-context"
import type { CreateProductInput } from "@/lib/validation/square.schema"

type CreatePresetInput = {
  name: string
  option: NonNullable<CreateProductInput["options"]>[number]
}

export async function listOptionPresets(): Promise<SquareOptionPreset[]> {
  const clientId = await getActiveClientId()
  const presets = await listMirrorOptionPresets(clientId)
  return presets.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getOptionPreset(
  rawId: string
): Promise<SquareOptionPreset | null> {
  const clientId = await getActiveClientId()
  return getMirrorOptionPreset(clientId, rawId)
}

export async function createOptionPreset(
  input: CreatePresetInput
): Promise<SquareOptionPreset> {
  const clientId = await getActiveClientId()
  const rawId = randomUUID()
  const now = new Date().toISOString()

  const preset: SquareOptionPreset = {
    client_id: clientId,
    id: optionPresetSK(rawId),
    raw_id: rawId,
    type: "sqoptpreset",
    name: input.name,
    option: input.option,
    created_at: now,
    updated_at: now,
  }

  await putMirrorOptionPreset(preset)
  return preset
}

export async function updateOptionPreset(
  rawId: string,
  input: Partial<CreatePresetInput>
): Promise<SquareOptionPreset> {
  const clientId = await getActiveClientId()
  const existing = await getMirrorOptionPreset(clientId, rawId)
  if (!existing) throw new Error(`Option preset ${rawId} not found`)

  const updated: SquareOptionPreset = {
    ...existing,
    name: input.name ?? existing.name,
    option: input.option ?? existing.option,
    updated_at: new Date().toISOString(),
  }

  await putMirrorOptionPreset(updated)
  return updated
}

export async function deleteOptionPreset(rawId: string): Promise<void> {
  const clientId = await getActiveClientId()
  await deleteMirrorOptionPreset(clientId, rawId)
}

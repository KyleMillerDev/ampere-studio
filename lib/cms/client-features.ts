import type { ClientRecord } from "@/lib/cms/clients"

export type CatalogProvider = "stripe" | "square" | "custom"

export interface ClientFeatures {
  catalog: CatalogProvider | null
  blog: boolean
  analytics: boolean
  siteEditor: boolean
  rentals: boolean
  submissions: boolean
}

const DISABLED_STRINGS = new Set(["false", "0", "no", "off", "disabled"])

/** Whether a DynamoDB client attribute is enabled. */
export function isTruthyAttribute(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized || DISABLED_STRINGS.has(normalized)) return false
    return true
  }
  return Boolean(value)
}

/**
 * Resolves the catalog provider from a client's `catalog` attribute.
 * Truthy values without a known provider default to the custom CMS catalog.
 */
export function parseCatalogProvider(value: unknown): CatalogProvider | null {
  if (!isTruthyAttribute(value)) return null
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "stripe") return "stripe"
    if (normalized === "square") return "square"
    if (normalized === "custom") return "custom"
  }
  return "custom"
}

export function parseClientFeatures(record: ClientRecord): ClientFeatures {
  return {
    catalog: parseCatalogProvider(record.catalog),
    blog: isTruthyAttribute(record.blog),
    analytics: isTruthyAttribute(record.analytics),
    siteEditor: isTruthyAttribute(record.site_editor ?? record.siteEditor),
    rentals: isTruthyAttribute(record.rentals),
    submissions: isTruthyAttribute(record.submissions),
  }
}

/**
 * Central constants for the Ampere Studio CMS.
 *
 * Authentication is handled by Cognito via Amplify (see lib/auth).
 * Each user carries `custom:client_id`, which scopes CMS data in production.
 * In local development, the dev-only client selector can override that value
 * through a request cookie.
 *
 * Server-only: this module is imported from server components and API
 * routes that can read `process.env`. Client components receive the value
 * through props from their nearest server component ancestor.
 */

/**
 * Dev-only fallback when Cognito auth is not configured. Production uses each
 * user's `custom:client_id` from Cognito (see lib/cms/client-context.ts).
 */
export const CLIENT_ID: string =
  process.env.AMPERE_DEFAULT_CLIENT_ID?.trim() || "ampere"

export const AWS_REGION = process.env.AMPERE_AWS_REGION?.trim() || "us-east-2"

export const CONTENT_TABLE = "Ampere-Studio-Content"
export const SUBMISSIONS_TABLE = "Ampere-Sites-Form-Submissions"
export const CLIENTS_TABLE = "Ampere-Clients"

export const IMAGES_BUCKET = "Ampere-Studio-Public"
export const PUBLIC_BUCKET = "ampere-studio-public"

export const PUBLISH_BRANCH = "published-ampere-updates"

/** SK prefixes on the content table. Kept as a union for type narrowing. */
export const SK_PREFIX = {
  product: "prod_",
  category: "cat_",
  image: "img_",
  article: "art_",
  rental: "rent_",
} as const

export type ContentType = keyof typeof SK_PREFIX

/**
 * Square mirror SK prefixes. All rows additionally carry `raw_id` (the
 * un-prefixed Square catalog / order ID) and a `type` discriminant.
 *
 * Published vs draft items use different prefixes so storefronts can query
 * only `sqprod_` without scanning drafts. Publish/unpublish is a
 * delete-old-prefix + put-new-prefix transaction.
 */
export const SQUARE_SK_PREFIX = {
  /** Published Square catalog ITEM (is_archived=false, online_visible=true) */
  product: "sqprod_",
  /** Draft / archived Square catalog ITEM */
  productDraft: "sqproddraft_",
  /** Square CATEGORY */
  category: "sqcat_",
  /** Assembled DISCOUNT+PRICING_RULE+PRODUCT_SET bundle */
  discount: "sqdiscount_",
  /** ITEM_OPTION catalog object (reference; embedded in product rows too) */
  option: "sqoption_",
  /** MODIFIER_LIST catalog object */
  modifierList: "sqmodlist_",
  /** CMS-only item-option preset template (not a Square catalog object) */
  optionPreset: "sqoptpreset_",
  /** Mirrored Square order */
  order: "sqorder_",
  /** Sync watermark row */
  syncMeta: "sqmeta_sync",
} as const

export type SquareSKPrefixKey = keyof typeof SQUARE_SK_PREFIX

/** Editor session store is in-memory. Sessions expire to cap server memory. */
export const EDITOR_SESSION_TTL_MS = 60 * 60 * 1000

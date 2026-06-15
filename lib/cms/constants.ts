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

export const AWS_REGION = "us-east-2"

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
} as const

export type ContentType = keyof typeof SK_PREFIX

/** Editor session store is in-memory. Sessions expire to cap server memory. */
export const EDITOR_SESSION_TTL_MS = 60 * 60 * 1000

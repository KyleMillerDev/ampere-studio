/**
 * Derive the request origin from headers. Works on Vercel and locally.
 * Pattern extracted from app/api/articles/[id]/checkout/route.ts.
 */
export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "http"
  if (host) return `${proto}://${host}`
  return new URL(req.url).origin
}

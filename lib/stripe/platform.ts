import Stripe from "stripe"

const AI_ARTICLE_PRODUCT_NAME = "AI Generated Article"
const AI_ARTICLE_METADATA_KEY = "ampere_ai_article"
const AI_ARTICLE_PRICE_CENTS = 499

let cachedStripe: Stripe | null = null
let cachedPriceId: string | null = null

export class PlatformStripeNotConfiguredError extends Error {
  constructor() {
    super("Platform Stripe is not configured")
    this.name = "PlatformStripeNotConfiguredError"
  }
}

export function getPlatformStripe(): Stripe {
  const secretKey = process.env.AMPERE_PLATFORM_STRIPE_SECRET_KEY?.trim()
  if (!secretKey) throw new PlatformStripeNotConfiguredError()
  if (!cachedStripe) {
    cachedStripe = new Stripe(secretKey)
  }
  return cachedStripe
}

export async function ensureAiArticlePriceId(): Promise<string> {
  const fromEnv = process.env.AI_ARTICLE_PRICE_ID?.trim()
  if (fromEnv) return fromEnv
  if (cachedPriceId) return cachedPriceId

  const stripe = getPlatformStripe()

  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata?.[AI_ARTICLE_METADATA_KEY] === "true") {
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 10,
      })
      const match = prices.data.find(
        (p) =>
          p.unit_amount === AI_ARTICLE_PRICE_CENTS &&
          p.currency === "usd" &&
          p.type === "one_time"
      )
      if (match) {
        cachedPriceId = match.id
        return match.id
      }
    }
  }

  const product = await stripe.products.create({
    name: AI_ARTICLE_PRODUCT_NAME,
    description:
      "AI-generated blog article. Billed when the article is published.",
    metadata: { [AI_ARTICLE_METADATA_KEY]: "true" },
    default_price_data: {
      currency: "usd",
      unit_amount: AI_ARTICLE_PRICE_CENTS,
    },
  })

  const priceId =
    typeof product.default_price === "string"
      ? product.default_price
      : product.default_price?.id

  if (!priceId) {
    throw new Error("Failed to create AI Generated Article price")
  }

  cachedPriceId = priceId
  return priceId
}

export async function createAiArticleCheckoutSession(params: {
  articleId: string
  origin: string
}): Promise<string> {
  const stripe = getPlatformStripe()
  const priceId = await ensureAiArticlePriceId()
  const base = params.origin.replace(/\/$/, "")

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { articleId: params.articleId },
    success_url: `${base}/articles/${params.articleId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/articles/${params.articleId}?checkout=cancel`,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL")
  }
  return session.url
}

export async function retrieveCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getPlatformStripe()
  return stripe.checkout.sessions.retrieve(sessionId)
}

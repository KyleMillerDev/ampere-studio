/** Skip Stripe checkout for AI article publish when running locally. */
export function isAiArticlePaymentBypassed(): boolean {
  return process.env.NODE_ENV === "development"
}

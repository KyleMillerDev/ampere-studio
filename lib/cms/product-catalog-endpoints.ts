/** Client fetch paths for a product catalog that shares the Stripe builder UI. */
export type ProductCatalogEndpoints = {
  collection: string
  product: (productId: string) => string
  prices: (productId: string) => string
  price: (priceId: string) => string
}

export const stripeCatalogEndpoints: ProductCatalogEndpoints = {
  collection: "/api/stripe/products",
  product: (id) => `/api/stripe/products/${id}`,
  prices: (id) => `/api/stripe/products/${id}/prices`,
  price: (id) => `/api/stripe/prices/${id}`,
}

export const ampereCatalogEndpoints: ProductCatalogEndpoints = {
  collection: "/api/ampere/products",
  product: (id) => `/api/ampere/products/${id}`,
  prices: (id) => `/api/ampere/products/${id}/prices`,
  price: (id) => `/api/ampere/prices/${id}`,
}

import { describe, expect, it } from "vitest"

import {
  collectMetadataSuggestions,
  readAmpereStoredProduct,
  toAmperePriceViews,
  toAmpereProductView,
  type AmpereStoredProduct,
} from "@/lib/ampere/products"
import { parseCatalogProvider } from "@/lib/cms/client-features"
import {
  ampereProductCreateSchema,
  ampereProductUpdateSchema,
} from "@/lib/validation/ampere-product.schema"

function sampleProduct(
  overrides: Partial<AmpereStoredProduct> = {}
): AmpereStoredProduct {
  return {
    client_id: "client_1",
    id: "ampprod_1",
    kind: "ampere_product",
    name: "Canvas tote",
    description: "A sturdy tote.",
    active: true,
    images: [],
    metadata: {},
    defaultPriceId: null,
    prices: [],
    created: 100,
    updated: 100,
    ...overrides,
  }
}

describe("parseCatalogProvider ampere", () => {
  it("treats catalog=ampere as the in-house catalog", () => {
    expect(parseCatalogProvider("ampere")).toBe("ampere")
    expect(parseCatalogProvider(" Ampere ")).toBe("ampere")
  })

  it("leaves the other providers alone", () => {
    expect(parseCatalogProvider("stripe")).toBe("stripe")
    expect(parseCatalogProvider("square")).toBe("square")
    expect(parseCatalogProvider("custom")).toBe("custom")
    expect(parseCatalogProvider("yes")).toBe("custom")
    expect(parseCatalogProvider(true)).toBe("custom")
    expect(parseCatalogProvider(false)).toBeNull()
    expect(parseCatalogProvider(null)).toBeNull()
  })
})

describe("ampere product schema", () => {
  it("accepts a product with no price", () => {
    const parsed = ampereProductCreateSchema.parse({ name: "Tote" })
    expect(parsed.name).toBe("Tote")
    expect(parsed.defaultPrice).toBeUndefined()
    expect(parsed.active).toBe(true)
  })

  it("rejects a zero amount when a price is included", () => {
    const parsed = ampereProductCreateSchema.safeParse({
      name: "Tote",
      defaultPrice: { currency: "usd", unitAmount: 0, type: "one_time" },
    })
    expect(parsed.success).toBe(false)
  })

  it("allows clearing the default price", () => {
    const parsed = ampereProductUpdateSchema.parse({ defaultPriceId: null })
    expect(parsed.defaultPriceId).toBeNull()
  })
})

describe("ampere product views", () => {
  it("has no default price when none was saved", () => {
    const view = toAmpereProductView(sampleProduct())
    expect(view.defaultPrice).toBeNull()
    expect(view.defaultPriceId).toBeNull()
  })

  it("marks the default price and keeps the rest", () => {
    const product = sampleProduct({
      defaultPriceId: "ampprice_new",
      prices: [
        {
          id: "ampprice_old",
          active: false,
          currency: "usd",
          unitAmount: 1200,
          type: "one_time",
          created: 10,
        },
        {
          id: "ampprice_new",
          active: true,
          currency: "usd",
          unitAmount: 1800,
          type: "recurring",
          interval: "month",
          intervalCount: 1,
          nickname: "Monthly",
          created: 20,
        },
      ],
    })
    const view = toAmpereProductView(product)
    expect(view.defaultPrice?.unitAmount).toBe(1800)
    expect(view.defaultPrice?.isDefault).toBe(true)
    expect(view.defaultPrice?.type).toBe("recurring")

    const prices = toAmperePriceViews(product)
    expect(prices.map((price) => price.id)).toEqual([
      "ampprice_new",
      "ampprice_old",
    ])
    expect(prices[1]?.isDefault).toBe(false)
  })

  it("drops a default id that does not match a saved price", () => {
    const view = toAmpereProductView(
      sampleProduct({ defaultPriceId: "ampprice_missing" })
    )
    expect(view.defaultPriceId).toBeNull()
    expect(view.defaultPrice).toBeNull()
  })

  it("reads a stored item and ignores a bad price", () => {
    const product = readAmpereStoredProduct({
      client_id: "client_1",
      id: "ampprod_1",
      name: "Tote",
      active: true,
      prices: [{ id: "not-a-price" }, { nope: true }],
    })
    expect(product?.prices).toEqual([])
    expect(product?.defaultPriceId).toBeNull()
    expect(readAmpereStoredProduct({ id: "prod_old", client_id: "c" })).toBeNull()
  })

  it("collects reusable metadata values and skips id-like keys", () => {
    const suggestions = collectMetadataSuggestions([
      { metadata: { Color: "Natural", sku_id: "a" } },
      { metadata: { Color: "Black", Material: "Canvas" } },
    ])
    expect(suggestions.Color).toEqual(["Black", "Natural"])
    expect(suggestions.Material).toEqual(["Canvas"])
    expect(suggestions.sku_id).toEqual([])
  })
})

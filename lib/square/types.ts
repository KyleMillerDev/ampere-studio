/**
 * Square commerce types for Ampere Studio.
 * Ported from kmcms square-types.ts + types.ts with added modifier support
 * and mirror-specific enrichment fields.
 */

// ─── Money ───────────────────────────────────────────────────────────────────

export type Money = {
  amount: number
  currency: "USD"
}

// ─── Item Options (dimension for variations) ─────────────────────────────────

export interface ItemOptionValueData {
  item_option_id?: string
  name: string
  ordinal?: number
  /** Additive price markup in dollars. Persisted explicitly in the mirror. */
  km_markup?: number
}

export interface ItemOptionValue {
  type?: string
  id?: string
  version?: number
  item_option_value_data: ItemOptionValueData
  image?: File
  image_url?: string
}

export interface ItemOptionData {
  name: string
  display_name?: string
  show_colors?: boolean
  values: ItemOptionValue[]
}

export interface ItemOption {
  type?: string
  id?: string
  updated_at?: string
  created_at?: string
  version?: number
  is_deleted?: boolean
  present_at_all_locations?: boolean
  item_option_data: ItemOptionData
}

/** CMS-only template stored in Ampere-Studio-Content (not a Square catalog object). */
export interface SquareOptionPreset {
  client_id: string
  /** SK prefix: sqoptpreset_<uuid> */
  id: string
  raw_id: string
  type: "sqoptpreset"
  name: string
  option: ItemOption
  created_at: string
  updated_at: string
}

// ─── Modifiers ────────────────────────────────────────────────────────────────

export type CatalogModifier = {
  id: string
  name: string
  ordinal?: number
  price?: Money
  image_id?: string
  version?: number
  modifier_data: {
    name: string
    modifier_list_id: string
    ordinal?: number
    price_money?: Money
    image_url?: string
  }
}

export type CatalogModifierList = {
  id: string
  version?: number
  name: string
  ordinal?: number
  selection_type: "SINGLE" | "MULTIPLE"
  modifier_type: "TEXT" | "LIST"
  modifiers: CatalogModifier[]
  image_ids?: string[]
  modifier_list_data: {
    name: string
    modifiers: CatalogModifier[]
    selection_type?: "SINGLE" | "MULTIPLE"
    modifier_type?: "TEXT" | "LIST"
    ordinal?: number
  }
}

/** Info attached to a Square catalog ITEM to reference a modifier list. */
export type ModifierListInfo = {
  modifier_list_id: string
  enabled?: boolean
  min_selected_modifiers?: number
  max_selected_modifiers?: number
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type CatalogCategory = {
  type: "CATEGORY"
  id: string
  version?: number
  created_at?: string
  updated_at?: string
  km_status?: "Featured" | "Published" | "Draft"
  custom_attribute_values?: {
    last_modified_by?: { string_value: string }
    category_description?: { string_value: string }
    category_order_deadline?: { string_value: string }
  }
  category_data: CatalogCategoryData
}

export type CatalogCategoryData = {
  name: string
  category_type: "REGULAR_CATEGORY"
  image_ids?: string[]
  image_urls?: string[]
  description_html?: string
  description_plaintext?: string
  online_visibility?: boolean
  is_archived?: boolean
  km_available_from_date?: string
  km_available_until_date?: string
  km_product_ids?: string[]
}

// ─── Item Variations ──────────────────────────────────────────────────────────

export type CatalogItemVariation = {
  type?: "ITEM_VARIATION"
  id: string
  version?: number
  image_ids?: string[]
  image_urls?: string[]
  item_variation_data: CatalogItemVariationData
}

export type CatalogItemVariationData = {
  item_id: string
  name: string
  ordinal?: number
  /** Current inventory count. Transient on write; persisted in mirror. */
  km_inventory?: number
  km_inventory_status?: string
  track_inventory?: boolean
  pricing_type: "FIXED_PRICING" | "VARIABLE_PRICING"
  price_money: Money
  image_ids?: string[]
  image_urls?: string[]
  location_overrides?: { track_inventory: boolean }[]
  item_option_values?: {
    item_option_id?: string
    item_option_value_id?: string
  }[]
}

// ─── Catalog Items (Products) ─────────────────────────────────────────────────

export type CatalogItemData = {
  name: string
  description_html?: string
  description_plaintext?: string
  is_archived?: boolean
  available_online?: boolean
  image_ids?: string[]
  image_urls?: string[]
  categories?: { id: string; ordinal?: number }[]
  variations: CatalogItemVariation[]
  item_options?: { item_option_id: string }[]
  modifier_list_info?: ModifierListInfo[]
  km_available_from_date?: string
  km_available_until_date?: string
  km_discount_amount?: number
  /** Per-option-value markups, keyed by option_value_id. Stored explicitly (no inference). */
  km_markups?: Record<string, number>
}

export type CatalogObject = {
  type:
    | "ITEM"
    | "IMAGE"
    | "CATEGORY"
    | "ITEM_VARIATION"
    | "TAX"
    | "DISCOUNT"
    | "MODIFIER_LIST"
    | "MODIFIER"
  id: string
  version?: number
  created_at?: string
  updated_at?: string
  is_deleted?: boolean
  km_status?: "Featured" | "Published" | "Draft"
  item_data: CatalogItemData
  custom_attribute_values?: {
    last_modified_by?: { string_value: string }
    allow_product_note?: { boolean_value: boolean }
    allow_product_personalization?: { boolean_value: boolean }
    allowed_fulfillments?: { string_value: string }
    category_description?: { string_value: string }
    category_order_deadline?: { string_value: string }
  }
}

// ─── Discounts ────────────────────────────────────────────────────────────────

export type CatalogDiscount = {
  type: "DISCOUNT"
  id: string
  version?: number
  created_at?: string
  updated_at?: string
  discount_data: {
    name: string
    discount_type: "FIXED_PERCENTAGE" | "FIXED_AMOUNT"
    percentage?: string
    amount_money?: Money
    pin_required?: boolean
    label_color?: string
    modify_tax_basis?: string
  }
}

export type CatalogPricingRule = {
  type: "PRICING_RULE"
  id: string
  version?: number
  pricing_rule_data: {
    name: string
    discount_id?: string
    match_products_id?: string
    application_mode?: "AUTOMATIC" | "MANUAL"
    valid_from_date?: string
    valid_until_date?: string
    valid_from_local_time?: string
    valid_until_local_time?: string
    disabled_pricing_sources?: string[]
  }
}

export type CatalogProductSet = {
  type: "PRODUCT_SET"
  id: string
  product_set_data: {
    name?: string
    product_ids_any?: string[]
    product_ids_all?: string[]
  }
}

/** Assembled discount record stored in mirror. */
export type SquareMirrorDiscount = {
  client_id: string
  /** SK: sqdiscount_<discount.id> */
  id: string
  raw_id: string
  type: "sqdiscount"
  slug: string
  discount: CatalogDiscount
  pricing_rule?: CatalogPricingRule
  product_set?: CatalogProductSet
  /** Square item IDs this discount targets (empty = all). */
  target_product_ids: string[]
  /** Square category IDs this discount targets. */
  target_category_ids: string[]
  created_at: string
  updated_at: string
  is_active: boolean
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type KmOrderState =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED"
  | "ABANDONED_CHECKOUT"

export type SquareAddress = {
  address_line_1?: string
  address_line_2?: string
  locality?: string
  administrative_district_level_1?: string
  postal_code?: string
  country?: string
}

export type SquareFulfillment = {
  uid: string
  type?: "PICKUP" | "SHIPMENT" | "DELIVERY" | "DIGITAL"
  state:
    | "PROPOSED"
    | "RESERVED"
    | "PREPARED"
    | "COMPLETED"
    | "CANCELED"
    | "FAILED"
  pickup_details?: {
    recipient?: {
      display_name?: string
      phone_number?: string
      email_address?: string
      address?: SquareAddress
    }
    schedule_type?: string
    pickup_at?: string
    note?: string
  }
  shipment_details?: {
    recipient?: {
      display_name?: string
      phone_number?: string
      email_address?: string
      address?: SquareAddress
    }
    carrier?: string
    tracking_number?: string
    shipping_type?: string
    tracking_url?: string
  }
}

export type SquareOrderLineItem = {
  uid?: string
  name?: string
  variation_name?: string
  quantity: string
  catalog_object_id?: string
  base_price_money?: Money
  gross_sales_money?: Money
  total_money?: Money
  total_discount_money?: Money
  total_tax_money?: Money
  note?: string
  modifiers?: Array<{
    uid?: string
    catalog_object_id?: string
    name?: string
    total_price_money?: Money
    km_mod_name?: string
    km_mod_value?: string
  }>
}

export type SquareOrderTender = {
  id?: string
  type?:
    | "CARD"
    | "CASH"
    | "THIRD_PARTY_CARD"
    | "SQUARE_GIFT_CARD"
    | "NO_SALE"
    | "OTHER"
  amount_money?: Money
  tip_money?: Money
  card_details?: {
    status?: string
    card?: { card_brand?: string; last_4?: string }
  }
}

export type SquareOrder = {
  id: string
  location_id?: string
  created_at: string
  updated_at?: string
  closed_at?: string
  state: "OPEN" | "COMPLETED" | "CANCELED" | "DRAFT"
  version?: number
  total_money?: Money
  total_tax_money?: Money
  total_discount_money?: Money
  net_amount_due_money?: Money
  line_items?: SquareOrderLineItem[]
  fulfillments?: SquareFulfillment[]
  tenders?: SquareOrderTender[]
  source?: { name?: string }
  customer_id?: string
  km_state?: KmOrderState
}

// ─── Mirror row types ─────────────────────────────────────────────────────────

/** A mirrored Square ITEM row in Ampere-Studio-Content. */
export type SquareMirrorProduct = {
  client_id: string
  /**
   * SK: sqprod_<rawId> (published/not-archived) or sqproddraft_<rawId> (archived/draft).
   * Use raw_id to get the un-prefixed Square catalog ID.
   */
  id: string
  raw_id: string
  type: "sqprod" | "sqproddraft"
  slug: string
  version?: number
  created_at?: string
  updated_at?: string
  item_data: CatalogItemData
  /** Full ITEM_OPTION objects referenced by this product's variations. */
  options?: ItemOption[]
  /** MODIFIER_LIST objects attached to this product. */
  modifier_lists?: CatalogModifierList[]
  /** Winning PRICING_RULE for the active discount. */
  pricing_rule?: CatalogPricingRule
  km_status: "Featured" | "Published" | "Draft"
  custom_attribute_values?: CatalogObject["custom_attribute_values"]
}

/** A mirrored Square CATEGORY row. */
export type SquareMirrorCategory = {
  client_id: string
  id: string
  raw_id: string
  type: "sqcat"
  slug: string
  version?: number
  created_at?: string
  updated_at?: string
  category_data: CatalogCategoryData
  km_status: "Featured" | "Published" | "Draft"
}

/** Watermark row for incremental sync. */
export type SquareSyncMeta = {
  client_id: string
  id: "sqmeta_sync"
  refreshed_at: string
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export type RevenueByDay = { date: string; revenue: number }
export type RevenueByWeek = { week: string; revenue: number }
export type RevenueByMonth = { month: string; revenue: number }
export type OrdersByDay = { date: string; count: number }
export type OrdersByWeek = { week: string; count: number }
export type OrdersByMonth = { month: string; count: number }

export type TopProduct = {
  id: string
  name: string
  quantity: number
  revenue: number
}
export type TopVariation = { name: string; quantity: number; revenue: number }
export type TopOptionValue = { value: string; quantity: number }

export type RecentOrderSummary = {
  id: string
  created_at: string
  total_money: Money
  km_state: KmOrderState
  product_name: string
  extra_items: number
  source: string
}

export type DashboardSummary = {
  total_revenue: number
  total_sales_tax: number
  order_count: number
  avg_order_value: number
  orders_by_state: {
    OPEN: number
    IN_PROGRESS: number
    COMPLETED: number
    CANCELED: number
  }
  orders_by_fulfillment: { shipment: number; pickup: number; other: number }
  orders_by_day: OrdersByDay[]
  orders_by_week: OrdersByWeek[]
  orders_by_month: OrdersByMonth[]
  revenue_by_day: RevenueByDay[]
  revenue_by_week: RevenueByWeek[]
  revenue_by_month: RevenueByMonth[]
  top_products: TopProduct[]
  top_variations: TopVariation[]
  top_option_values: TopOptionValue[]
  recent_orders: RecentOrderSummary[]
  date_from: string
  date_to: string
}

// ─── Request payload types ────────────────────────────────────────────────────

export type SquareCreateProductRequest = {
  name: string
  price: number
  description_html?: string
  image_urls?: string[]
  category_ids?: string[]
  status: "Published" | "Draft"
  available_online?: boolean
  available_from_date?: string
  available_until_date?: string
  allow_product_note?: boolean
  allow_product_personalization?: boolean
  allowed_fulfillments?: string
  options?: ItemOption[]
  modifier_list_ids?: string[]
  modifiers?: SquareCreateModifierListRequest[]
}

export type SquareUpdateProductRequest = Partial<SquareCreateProductRequest> & {
  existing_variations?: CatalogItemVariation[]
  existing_options?: ItemOption[]
}

export type SquareCreateCategoryRequest = {
  name: string
  image_url?: string
  description_html?: string
  order_deadline?: string
  status: "Published" | "Draft" | "Featured"
  available_online?: boolean
  available_from_date?: string
  available_until_date?: string
}

export type SquareCreateDiscountRequest = {
  name: string
  discount: { percentage: number } | { amount: number }
  product_ids?: string[]
  category_ids?: string[]
  pricing_rule: {
    valid_from_date: string
    valid_until_date: string
    valid_from_local_time: string
    valid_until_local_time: string
  }
}

export type SquareCreateModifierListRequest = {
  name: string
  selection_type: "SINGLE" | "MULTIPLE"
  modifiers: Array<{
    name: string
    price_cents?: number
    ordinal?: number
  }>
}

export type SquareOAuthTokens = {
  access_token: string
  refresh_token: string
  environment: "production" | "sandbox"
  redirect_url: string
  location_id: string
  client_id: string
  client_secret: string
}

/**
 * Drizzle mirror of supabase/migrations/*.sql (the SQL files are the source of
 * truth: they also carry RLS policies, triggers and Supabase-only objects).
 * `npm run db:check` verifies this file against a freshly migrated database.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ---------------------------------------------------------------------------
// auth (provided by Supabase, or by the local shim)
// ---------------------------------------------------------------------------
export const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  phone: text("phone"),
  encryptedPassword: text("encrypted_password"),
  rawUserMetaData: jsonb("raw_user_meta_data").$type<Record<string, unknown>>(),
  createdAt: tstz("created_at").defaultNow(),
  lastSignInAt: tstz("last_sign_in_at"),
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const fulfillmentType = pgEnum("fulfillment_type", ["delivery", "pickup"]);
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "received",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "wallet", "fawry", "valu", "instapay"]);
export const paymentProvider = pgEnum("payment_provider", ["cod", "paymob", "instapay"]);
export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "pending_review",
  "paid",
  "failed",
  "refunded",
  "cancelled",
]);
export const discountType = pgEnum("discount_type", ["percent", "fixed"]);
export const notificationStatus = pgEnum("notification_status", ["queued", "sent", "mocked", "failed"]);

// ---------------------------------------------------------------------------
// People & roles
// ---------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  email: text("email"),
  preferredLocale: text("preferred_locale").$type<"ar" | "en">().notNull().default("ar"),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  key: text("key").$type<StaffRole>().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  description: text("description"),
  rank: smallint("rank").notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull(),
    roleKey: text("role_key").$type<StaffRole>().notNull(),
    grantedBy: uuid("granted_by"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleKey] })],
);

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull(),
  slug: text("slug").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  basePricePiasters: integer("base_price_piasters").notNull(),
  imageUrl: text("image_url"),
  isSpicy: boolean("is_spicy").notNull().default(false),
  isVegetarian: boolean("is_vegetarian").notNull().default(false),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isSoldOut: boolean("is_sold_out").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const itemSizes = pgTable("item_sizes", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuItemId: uuid("menu_item_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  pricePiasters: integer("price_piasters").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const addonGroups = pgTable("addon_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  minSelect: smallint("min_select").notNull().default(0),
  maxSelect: smallint("max_select"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const addons = pgTable("addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  pricePiasters: integer("price_piasters").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItemAddonGroups = pgTable(
  "menu_item_addon_groups",
  {
    menuItemId: uuid("menu_item_id").notNull(),
    addonGroupId: uuid("addon_group_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.addonGroupId] })],
);

// ---------------------------------------------------------------------------
// Delivery, hours, settings, addresses
// ---------------------------------------------------------------------------
export const deliveryZones = pgTable("delivery_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  feePiasters: integer("fee_piasters").notNull(),
  minOrderPiasters: integer("min_order_piasters").notNull().default(0),
  etaMinMinutes: smallint("eta_min_minutes").notNull(),
  etaMaxMinutes: smallint("eta_max_minutes").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const openingHours = pgTable("opening_hours", {
  dayOfWeek: smallint("day_of_week").primaryKey(),
  opensAt: time("opens_at").notNull(),
  closesAt: time("closes_at").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  label: text("label"),
  zoneId: uuid("zone_id").notNull(),
  street: text("street").notNull(),
  building: text("building").notNull(),
  floor: text("floor"),
  apartment: text("apartment"),
  landmark: text("landmark"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------
export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  discountType: discountType("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  maxDiscountPiasters: integer("max_discount_piasters"),
  minSubtotalPiasters: integer("min_subtotal_piasters").notNull().default(0),
  startsAt: tstz("starts_at"),
  endsAt: tstz("ends_at"),
  usageLimit: integer("usage_limit"),
  perPhoneLimit: integer("per_phone_limit"),
  timesUsed: integer("times_used").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  subtitleAr: text("subtitle_ar"),
  subtitleEn: text("subtitle_en"),
  badgeAr: text("badge_ar"),
  badgeEn: text("badge_en"),
  imageUrl: text("image_url"),
  menuItemId: uuid("menu_item_id"),
  promoCodeId: uuid("promo_code_id"),
  startsAt: tstz("starts_at"),
  endsAt: tstz("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: integer("order_number").generatedAlwaysAsIdentity({ startWith: 1001 }),
  trackingToken: text("tracking_token")
    .notNull()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  userId: uuid("user_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  fulfillmentType: fulfillmentType("fulfillment_type").notNull(),
  zoneId: uuid("zone_id"),
  addressStreet: text("address_street"),
  addressBuilding: text("address_building"),
  addressFloor: text("address_floor"),
  addressApartment: text("address_apartment"),
  addressLandmark: text("address_landmark"),
  addressLat: doublePrecision("address_lat"),
  addressLng: doublePrecision("address_lng"),
  scheduledFor: tstz("scheduled_for"),
  status: orderStatus("status").notNull().default("received"),
  paymentMethod: paymentMethod("payment_method").notNull().default("cash"),
  paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
  subtotalPiasters: integer("subtotal_piasters").notNull(),
  discountPiasters: integer("discount_piasters").notNull().default(0),
  deliveryFeePiasters: integer("delivery_fee_piasters").notNull().default(0),
  vatPiasters: integer("vat_piasters").notNull().default(0),
  totalPiasters: integer("total_piasters").notNull(),
  vatRateBps: integer("vat_rate_bps").notNull().default(1400),
  pricesIncludeVat: boolean("prices_include_vat").notNull().default(true),
  promoCodeId: uuid("promo_code_id"),
  promoCode: text("promo_code"),
  notes: text("notes"),
  locale: text("locale").$type<"ar" | "en">().notNull().default("ar"),
  assignedDriverId: uuid("assigned_driver_id"),
  cancelReason: text("cancel_reason"),
  placedAt: tstz("placed_at").notNull().defaultNow(),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  menuItemId: uuid("menu_item_id"),
  sizeId: uuid("size_id"),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  sizeNameAr: text("size_name_ar"),
  sizeNameEn: text("size_name_en"),
  unitPricePiasters: integer("unit_price_piasters").notNull(),
  addonsUnitPiasters: integer("addons_unit_piasters").notNull().default(0),
  quantity: integer("quantity").notNull(),
  lineTotalPiasters: integer("line_total_piasters").notNull(),
  notes: text("notes"),
});

export const orderItemAddons = pgTable("order_item_addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id").notNull(),
  addonId: uuid("addon_id"),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  pricePiasters: integer("price_piasters").notNull(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orderId: uuid("order_id").notNull(),
  fromStatus: orderStatus("from_status"),
  toStatus: orderStatus("to_status").notNull(),
  changedBy: uuid("changed_by"),
  note: text("note"),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  provider: paymentProvider("provider").notNull(),
  method: paymentMethod("method").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  amountPiasters: integer("amount_piasters").notNull(),
  currency: text("currency").notNull().default("EGP"),
  providerRef: text("provider_ref"),
  providerOrderId: text("provider_order_id"),
  proofPath: text("proof_path"),
  payerReference: text("payer_reference"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: tstz("reviewed_at"),
  reviewNote: text("review_note"),
  raw: jsonb("raw"),
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Reviews, notifications, rate limits
// ---------------------------------------------------------------------------
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id"),
  userId: uuid("user_id"),
  customerName: text("customer_name").notNull(),
  rating: smallint("rating").notNull(),
  comment: text("comment"),
  locale: text("locale").$type<"ar" | "en">().notNull().default("ar"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const notificationLog = pgTable("notification_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id"),
  channel: text("channel").$type<"whatsapp" | "sms">().notNull().default("whatsapp"),
  audience: text("audience").$type<"customer" | "restaurant">().notNull(),
  recipient: text("recipient").notNull(),
  template: text("template").notNull(),
  body: text("body").notNull(),
  provider: text("provider").notNull(),
  status: notificationStatus("status").notNull().default("queued"),
  error: text("error"),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowStart: tstz("window_start").notNull(),
    hits: integer("hits").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })],
);

export type StaffRole = "owner" | "manager" | "kitchen" | "driver";
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type FulfillmentType = (typeof fulfillmentType.enumValues)[number];

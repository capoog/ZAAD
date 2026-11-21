import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { canTransition, type OrderStatus } from "@/lib/order-status";
import { getOpenStatus } from "@/lib/hours";
import { EG_MOBILE_REGEX, normalizeEgyptianPhone } from "@/lib/phone";
import { priceOrder, type PricingError } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { getDb, withActor } from "../db";
import * as s from "../db/schema";
import { sendWhatsApp } from "../notify";
import { publish } from "../realtime";
import { getMenuFresh, getPublicSettings, getZones } from "./catalog";
import { checkPromo, type PromoError } from "./promos";
import { env } from "../env";

// ── Input validation & sanitisation ─────────────────────────────────────────
/** Collapse whitespace and strip control characters / angle brackets. */
const clean = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

const optionalClean = (max: number) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max))
    .transform((v) => v || null);

export const placeOrderSchema = z
  .object({
    lines: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          sizeId: z.string().uuid().nullable().optional(),
          addonIds: z.array(z.string().uuid()).max(20).default([]),
          quantity: z.number().int().min(1).max(50),
          notes: optionalClean(200),
        }),
      )
      .min(1)
      .max(40),
    fulfillment: z.enum(["delivery", "pickup"]),
    zoneId: z.string().uuid().nullable().optional(),
    address: z
      .object({
        street: clean(120).pipe(z.string().min(2)),
        building: clean(30).pipe(z.string().min(1)),
        floor: optionalClean(10),
        apartment: optionalClean(10),
        landmark: optionalClean(120),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
      })
      .nullable()
      .optional(),
    customer: z.object({
      name: clean(80).pipe(z.string().min(2)),
      phone: z.string().transform(normalizeEgyptianPhone).pipe(z.string().regex(EG_MOBILE_REGEX)),
    }),
    scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
    paymentMethod: z.enum(["cash", "card", "wallet", "fawry", "valu", "instapay"]),
    promoCode: z.string().max(40).nullable().optional(),
    notes: optionalClean(500),
    locale: z.enum(["ar", "en"]).default("ar"),
    saveAddress: z.boolean().optional(),
  })
  .refine((v) => v.fulfillment === "pickup" || (v.zoneId && v.address), { message: "address required", path: ["address"] });

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export type PlaceOrderError =
  | { code: "VALIDATION"; fields: string[] }
  | { code: "CLOSED"; opensAt: string | null }
  | { code: "PAUSED" }
  | { code: "SCHEDULE_INVALID" }
  | { code: "PAYMENT_DISABLED" }
  | { code: "ZONE_INVALID" }
  | { code: "PRICING"; errors: PricingError[] }
  | { code: "PROMO"; error: PromoError; min?: number }
  | { code: "RATE_LIMITED" };

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: number; trackingToken: string; paymentId: string; next: "track" | "pay" | "instapay" }
  | { ok: false; error: PlaceOrderError };

/**
 * Creates an order. Every price comes from the database and is recalculated
 * here — the client only says *what* it wants.
 */
export async function placeOrder(raw: unknown, ctx: { userId: string | null; now?: Date }): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] } };
  }
  const input = parsed.data;
  const now = ctx.now ?? new Date();
  const [settings, zones, menu] = await Promise.all([getPublicSettings(), getZones(), getMenuFresh(true)]);

  if (!settings.ordering.acceptingOrders) return { ok: false, error: { code: "PAUSED" } };
  if (!settings.payments[input.paymentMethod]) return { ok: false, error: { code: "PAYMENT_DISABLED" } };
  if (input.paymentMethod === "instapay" && !settings.instapay.enabled) return { ok: false, error: { code: "PAYMENT_DISABLED" } };

  // Opening hours (Africa/Cairo) — ASAP orders only while open; scheduled orders
  // must land inside opening hours, after the lead time and within the window.
  const status = getOpenStatus(now, settings.hours);
  let scheduledFor: Date | null = null;
  if (input.scheduledFor) {
    scheduledFor = new Date(input.scheduledFor);
    const lead = settings.ordering.minScheduleLeadMinutes * 60_000;
    const max = settings.ordering.maxScheduleDays * 86_400_000;
    if (
      scheduledFor.getTime() < now.getTime() + lead - 60_000 ||
      scheduledFor.getTime() > now.getTime() + max ||
      !getOpenStatus(scheduledFor, settings.hours).isOpen ||
      (!status.isOpen && !settings.ordering.allowScheduledWhenClosed)
    ) {
      return { ok: false, error: { code: "SCHEDULE_INVALID" } };
    }
  } else if (!status.isOpen) {
    return { ok: false, error: { code: "CLOSED", opensAt: status.opensAt?.toISOString() ?? null } };
  }

  const zone = input.fulfillment === "delivery" ? zones.find((z) => z.id === input.zoneId) : null;
  if (input.fulfillment === "delivery" && !zone) return { ok: false, error: { code: "ZONE_INVALID" } };

  const items = new Map(menu.flatMap((c) => c.items).map((i) => [i.id, i]));
  const pre = priceOrder({ lines: input.lines, items, fulfillment: input.fulfillment, zone: zone ?? null, promo: null, vat: settings.vat });

  let promo = null;
  if (input.promoCode) {
    const check = await checkPromo(input.promoCode, { phone: input.customer.phone, subtotal: pre.subtotalPiasters });
    if (!check.ok) return { ok: false, error: { code: "PROMO", error: check.error, min: check.min } };
    promo = check.rule;
  }
  const priced = priceOrder({ lines: input.lines, items, fulfillment: input.fulfillment, zone: zone ?? null, promo, vat: settings.vat });
  if (priced.errors.length) return { ok: false, error: { code: "PRICING", errors: priced.errors } };

  const isOnline = ["card", "wallet", "fawry", "valu"].includes(input.paymentMethod);
  const initialStatus: OrderStatus = input.paymentMethod === "cash" ? "received" : "pending_payment";

  const created = await withActor(ctx.userId, async (tx) => {
    const [order] = await tx
      .insert(s.orders)
      .values({
        userId: ctx.userId,
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        fulfillmentType: input.fulfillment,
        zoneId: zone?.id ?? null,
        addressStreet: input.fulfillment === "delivery" ? (input.address?.street ?? null) : null,
        addressBuilding: input.fulfillment === "delivery" ? (input.address?.building ?? null) : null,
        addressFloor: input.fulfillment === "delivery" ? (input.address?.floor ?? null) : null,
        addressApartment: input.fulfillment === "delivery" ? (input.address?.apartment ?? null) : null,
        addressLandmark: input.fulfillment === "delivery" ? (input.address?.landmark ?? null) : null,
        addressLat: input.fulfillment === "delivery" ? (input.address?.lat ?? null) : null,
        addressLng: input.fulfillment === "delivery" ? (input.address?.lng ?? null) : null,
        scheduledFor,
        status: initialStatus,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cash" ? "unpaid" : "pending",
        subtotalPiasters: priced.subtotalPiasters,
        discountPiasters: priced.discountPiasters,
        deliveryFeePiasters: priced.deliveryFeePiasters,
        vatPiasters: priced.vatPiasters,
        totalPiasters: priced.totalPiasters,
        vatRateBps: priced.vatRateBps,
        pricesIncludeVat: priced.pricesIncludeVat,
        promoCodeId: priced.promo?.id ?? null,
        promoCode: priced.promo?.code ?? null,
        notes: input.notes,
        locale: input.locale,
        placedAt: now,
      })
      .returning();
    if (!order) throw new Error("order insert failed");

    for (const l of priced.lines) {
      const [oi] = await tx
        .insert(s.orderItems)
        .values({
          orderId: order.id,
          menuItemId: l.menuItemId,
          sizeId: l.sizeId,
          nameAr: l.nameAr,
          nameEn: l.nameEn,
          sizeNameAr: l.sizeNameAr,
          sizeNameEn: l.sizeNameEn,
          unitPricePiasters: l.unitPricePiasters,
          addonsUnitPiasters: l.addonsUnitPiasters,
          quantity: l.quantity,
          lineTotalPiasters: l.lineTotalPiasters,
          notes: l.notes,
        })
        .returning({ id: s.orderItems.id });
      if (oi && l.addons.length) {
        await tx.insert(s.orderItemAddons).values(
          l.addons.map((a) => ({ orderItemId: oi.id, addonId: a.id, nameAr: a.nameAr, nameEn: a.nameEn, pricePiasters: a.pricePiasters })),
        );
      }
    }

    const [payment] = await tx
      .insert(s.payments)
      .values({
        orderId: order.id,
        provider: input.paymentMethod === "cash" ? "cod" : input.paymentMethod === "instapay" ? "instapay" : "paymob",
        method: input.paymentMethod,
        status: "pending",
        amountPiasters: priced.totalPiasters,
      })
      .returning({ id: s.payments.id });
    if (!payment) throw new Error("payment insert failed");

    if (priced.promo) {
      await tx.update(s.promoCodes).set({ timesUsed: sql`${s.promoCodes.timesUsed} + 1` }).where(eq(s.promoCodes.id, priced.promo.id));
    }

    if (ctx.userId && input.saveAddress && input.fulfillment === "delivery" && input.address && zone) {
      const existing = await tx.select({ id: s.addresses.id }).from(s.addresses).where(eq(s.addresses.userId, ctx.userId));
      await tx.insert(s.addresses).values({
        userId: ctx.userId,
        zoneId: zone.id,
        street: input.address.street,
        building: input.address.building,
        floor: input.address.floor,
        apartment: input.address.apartment,
        landmark: input.address.landmark,
        lat: input.address.lat ?? null,
        lng: input.address.lng ?? null,
        isDefault: existing.length === 0,
        label: null,
      });
    }
    if (ctx.userId) {
      await tx.update(s.profiles).set({ fullName: sql`coalesce(${s.profiles.fullName}, ${input.customer.name})` }).where(eq(s.profiles.id, ctx.userId));
    }
    return { order, paymentId: payment.id };
  });

  const { order } = created;
  if (initialStatus === "received") await afterOrderReceived(order.id);

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber ?? 0,
    trackingToken: order.trackingToken,
    paymentId: created.paymentId,
    next: isOnline ? "pay" : input.paymentMethod === "instapay" ? "instapay" : "track",
  };
}

// ── Notifications & realtime on lifecycle events ────────────────────────────
const STATUS_TEXT: Record<OrderStatus, { ar: string; en: string }> = {
  pending_payment: { ar: "مستني تأكيد الدفع", en: "awaiting payment" },
  received: { ar: "استلمنا أوردرك وهنبدأ فيه حالاً 🔥", en: "we've received your order 🔥" },
  preparing: { ar: "أوردرك بيتحضّر على الفحم دلوقتي", en: "your order is on the grill" },
  ready_for_pickup: { ar: "أوردرك جاهز، عدّي استلمه", en: "your order is ready for pickup" },
  out_for_delivery: { ar: "الأوردر في الطريق ليك 🛵", en: "your order is on its way 🛵" },
  delivered: { ar: "بالهنا والشفا! قولنا رأيك 🙏", en: "delivered — enjoy! 🙏" },
  cancelled: { ar: "للأسف الأوردر اتلغى. كلّمنا لو محتاج أي حاجة.", en: "your order was cancelled. Contact us if you need anything." },
};

function trackUrl(token: string, locale: "ar" | "en") {
  return `${env().SITE_URL}${locale === "en" ? "/en" : ""}/orders/${token}`;
}

async function loadOrderBrief(orderId: string) {
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId)).limit(1);
  return o ?? null;
}

/** New order visible to the kitchen: alert the restaurant + confirm to customer. */
export async function afterOrderReceived(orderId: string): Promise<void> {
  const o = await loadOrderBrief(orderId);
  if (!o) return;
  await publish("staff:orders", { type: "order.created", orderId, status: o.status });
  await publish(`order:${o.trackingToken}`, { type: "order.updated", orderId, status: o.status });
  const settingsRow = await (await getDb()).select().from(s.settings).where(eq(s.settings.key, "notifications")).limit(1);
  const alertPhone = (settingsRow[0]?.value as { restaurantAlertPhone?: string } | undefined)?.restaurantAlertPhone ?? env().RESTAURANT_ALERT_PHONE;
  const amount = formatMoney(o.totalPiasters, "ar");
  await Promise.allSettled([
    sendWhatsApp({
      orderId,
      audience: "restaurant",
      to: alertPhone,
      template: "new_order",
      body: `🔔 أوردر جديد #${o.orderNumber}\n${o.customerName} · ${o.customerPhone}\n${o.fulfillmentType === "delivery" ? "توصيل" : "استلام من الفرع"} · ${amount} · ${o.paymentMethod}${o.scheduledFor ? `\n⏰ مجدول` : ""}`,
    }),
    sendWhatsApp({
      orderId,
      audience: "customer",
      to: o.customerPhone,
      template: "order_status_received",
      body:
        o.locale === "en"
          ? `Fahm & Zaatar: order #${o.orderNumber} — ${STATUS_TEXT.received.en}\nTrack it: ${trackUrl(o.trackingToken, "en")}`
          : `فحم وزعتر: أوردر #${o.orderNumber} — ${STATUS_TEXT.received.ar}\nتابعه من هنا: ${trackUrl(o.trackingToken, "ar")}`,
    }),
  ]);
}

export type TransitionError = "NOT_FOUND" | "INVALID_TRANSITION" | "PAYMENT_PENDING";

/** Staff status change with validation, audit (trigger) and notifications. */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actorId: string | null,
  opts: { cancelReason?: string | null; force?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: TransitionError }> {
  const o = await loadOrderBrief(orderId);
  if (!o) return { ok: false, error: "NOT_FOUND" };
  if (!opts.force && !canTransition(o.status, to, o.fulfillmentType)) return { ok: false, error: "INVALID_TRANSITION" };
  if (!opts.force && o.status === "pending_payment" && to === "received" && o.paymentStatus !== "paid") {
    return { ok: false, error: "PAYMENT_PENDING" };
  }
  await withActor(actorId, async (tx) => {
    await tx
      .update(s.orders)
      .set({
        status: to,
        cancelReason: to === "cancelled" ? (opts.cancelReason ?? null) : o.cancelReason,
        // Cash is collected on delivery.
        paymentStatus: to === "delivered" && o.paymentMethod === "cash" ? "paid" : to === "cancelled" && o.paymentStatus !== "paid" ? "cancelled" : o.paymentStatus,
      })
      .where(eq(s.orders.id, orderId));
    if (to === "delivered" && o.paymentMethod === "cash") {
      await tx.update(s.payments).set({ status: "paid" }).where(and(eq(s.payments.orderId, orderId), eq(s.payments.provider, "cod")));
    }
  });

  if (o.status === "pending_payment" && to === "received") {
    await afterOrderReceived(orderId);
    return { ok: true };
  }
  await publish("staff:orders", { type: "order.updated", orderId, status: to });
  await publish(`order:${o.trackingToken}`, { type: "order.updated", orderId, status: to });
  const text = STATUS_TEXT[to];
  await sendWhatsApp({
    orderId,
    audience: "customer",
    to: o.customerPhone,
    template: `order_status_${to}`,
    body:
      o.locale === "en"
        ? `Fahm & Zaatar: order #${o.orderNumber} — ${text.en}\n${trackUrl(o.trackingToken, "en")}`
        : `فحم وزعتر: أوردر #${o.orderNumber} — ${text.ar}\n${trackUrl(o.trackingToken, "ar")}`,
  }).catch(() => {});
  return { ok: true };
}

// ── Reads ───────────────────────────────────────────────────────────────────
export interface OrderDetail {
  id: string;
  orderNumber: number;
  trackingToken: string;
  status: OrderStatus;
  fulfillmentType: "delivery" | "pickup";
  paymentMethod: s.PaymentMethod;
  paymentStatus: s.PaymentStatus;
  customerName: string;
  customerPhone: string;
  zone: { nameAr: string; nameEn: string; etaMinMinutes: number; etaMaxMinutes: number } | null;
  address: { street: string | null; building: string | null; floor: string | null; apartment: string | null; landmark: string | null; lat: number | null; lng: number | null };
  scheduledFor: string | null;
  placedAt: string;
  notes: string | null;
  subtotalPiasters: number;
  discountPiasters: number;
  deliveryFeePiasters: number;
  vatPiasters: number;
  totalPiasters: number;
  vatRateBps: number;
  pricesIncludeVat: boolean;
  promoCode: string | null;
  cancelReason: string | null;
  items: {
    id: string;
    menuItemId: string | null;
    sizeId: string | null;
    nameAr: string;
    nameEn: string;
    sizeNameAr: string | null;
    sizeNameEn: string | null;
    quantity: number;
    lineTotalPiasters: number;
    notes: string | null;
    addons: { addonId: string | null; nameAr: string; nameEn: string; pricePiasters: number }[];
  }[];
  history: { status: OrderStatus; at: string }[];
  payment: { id: string; status: s.PaymentStatus; provider: string; proofPath: string | null; reviewNote: string | null } | null;
}

export async function getOrderDetail(where: { token?: string; id?: string }): Promise<OrderDetail | null> {
  const db = await getDb();
  const cond = where.token ? eq(s.orders.trackingToken, where.token) : eq(s.orders.id, where.id ?? "");
  const [row] = await db
    .select({ o: s.orders, z: s.deliveryZones })
    .from(s.orders)
    .leftJoin(s.deliveryZones, eq(s.deliveryZones.id, s.orders.zoneId))
    .where(cond)
    .limit(1);
  if (!row) return null;
  const o = row.o;
  const [items, history, pays] = await Promise.all([
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id)),
    db.select().from(s.orderStatusHistory).where(eq(s.orderStatusHistory.orderId, o.id)).orderBy(asc(s.orderStatusHistory.createdAt)),
    db.select().from(s.payments).where(eq(s.payments.orderId, o.id)).orderBy(desc(s.payments.createdAt)),
  ]);
  const addons = items.length
    ? await db.select().from(s.orderItemAddons).where(inArray(s.orderItemAddons.orderItemId, items.map((i) => i.id)))
    : [];
  const pay = pays[0];
  return {
    id: o.id,
    orderNumber: o.orderNumber ?? 0,
    trackingToken: o.trackingToken,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    zone: row.z ? { nameAr: row.z.nameAr, nameEn: row.z.nameEn, etaMinMinutes: row.z.etaMinMinutes, etaMaxMinutes: row.z.etaMaxMinutes } : null,
    address: {
      street: o.addressStreet,
      building: o.addressBuilding,
      floor: o.addressFloor,
      apartment: o.addressApartment,
      landmark: o.addressLandmark,
      lat: o.addressLat,
      lng: o.addressLng,
    },
    scheduledFor: o.scheduledFor?.toISOString() ?? null,
    placedAt: o.placedAt.toISOString(),
    notes: o.notes,
    subtotalPiasters: o.subtotalPiasters,
    discountPiasters: o.discountPiasters,
    deliveryFeePiasters: o.deliveryFeePiasters,
    vatPiasters: o.vatPiasters,
    totalPiasters: o.totalPiasters,
    vatRateBps: o.vatRateBps,
    pricesIncludeVat: o.pricesIncludeVat,
    promoCode: o.promoCode,
    cancelReason: o.cancelReason,
    items: items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      sizeId: i.sizeId,
      nameAr: i.nameAr,
      nameEn: i.nameEn,
      sizeNameAr: i.sizeNameAr,
      sizeNameEn: i.sizeNameEn,
      quantity: i.quantity,
      lineTotalPiasters: i.lineTotalPiasters,
      notes: i.notes,
      addons: addons
        .filter((a) => a.orderItemId === i.id)
        .map((a) => ({ addonId: a.addonId, nameAr: a.nameAr, nameEn: a.nameEn, pricePiasters: a.pricePiasters })),
    })),
    history: history.map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString() })),
    payment: pay ? { id: pay.id, status: pay.status, provider: pay.provider, proofPath: pay.proofPath, reviewNote: pay.reviewNote } : null,
  };
}

/**
 * After a phone number is verified by OTP, attach that phone's guest orders
 * to the account so they show up in order history.
 */
export async function claimGuestOrders(userId: string, phone: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .update(s.orders)
    .set({ userId })
    .where(and(eq(s.orders.customerPhone, phone), sql`${s.orders.userId} is null`))
    .returning({ id: s.orders.id });
  return rows.length;
}

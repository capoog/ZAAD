"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { EG_MOBILE_REGEX, normalizeEgyptianPhone } from "@/lib/phone";
import type { OrderStatus } from "@/lib/order-status";
import { getDb } from "../db";
import * as s from "../db/schema";
import { env, isSupabaseConfigured } from "../env";
import { ForbiddenError, MANAGERS, requireStaff, STAFF } from "../auth/guard";
import { hashPassword } from "../auth/password";
import { CACHE_TAGS, settingsSchemas } from "../services/catalog";
import { getBoard, type BoardData } from "../services/admin";
import { transitionOrder } from "../services/orders";
import { reviewInstapay } from "../services/payments";
import { publish } from "../realtime";
import { sniffImage, storage } from "../storage";
import { createClient } from "@supabase/supabase-js";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guarded<T>(roles: s.StaffRole[], fn: (session: Awaited<ReturnType<typeof requireStaff>>) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const session = await requireStaff(roles);
    return await fn(session);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: "FORBIDDEN" };
    console.error("[admin]", err);
    return { ok: false, error: "SERVER" };
  }
}

// ── Orders board ────────────────────────────────────────────────────────────
export async function boardAction(): Promise<Result<BoardData>> {
  return guarded(STAFF, async (session) => ({ ok: true, data: await getBoard(session) }));
}

const statuses = ["received", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"] as const;

export async function advanceOrderAction(raw: unknown): Promise<Result> {
  return guarded(STAFF, async (session) => {
    const v = z
      .object({ orderId: z.string().uuid(), to: z.enum(statuses), cancelReason: z.string().trim().max(200).optional() })
      .safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const onlyDriver = session.roles.every((r) => r === "driver");
    if (onlyDriver) {
      // Drivers can only complete deliveries assigned to them.
      const db = await getDb();
      const [o] = await db.select().from(s.orders).where(eq(s.orders.id, v.data.orderId)).limit(1);
      if (!o || o.assignedDriverId !== session.userId || v.data.to !== "delivered") return { ok: false, error: "FORBIDDEN" };
    }
    if (v.data.to === "cancelled" && !session.roles.some((r) => r === "owner" || r === "manager" || r === "kitchen")) {
      return { ok: false, error: "FORBIDDEN" };
    }
    const res = await transitionOrder(v.data.orderId, v.data.to as OrderStatus, session.userId, { cancelReason: v.data.cancelReason });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  });
}

export async function assignDriverAction(raw: unknown): Promise<Result> {
  return guarded(["owner", "manager", "kitchen"], async () => {
    const v = z.object({ orderId: z.string().uuid(), driverId: z.string().uuid().nullable() }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const db = await getDb();
    if (v.data.driverId) {
      const [isDriver] = await db
        .select()
        .from(s.userRoles)
        .where(and(eq(s.userRoles.userId, v.data.driverId), eq(s.userRoles.roleKey, "driver")))
        .limit(1);
      if (!isDriver) return { ok: false, error: "VALIDATION" };
    }
    await db.update(s.orders).set({ assignedDriverId: v.data.driverId }).where(eq(s.orders.id, v.data.orderId));
    await publish("staff:orders", { type: "order.updated", orderId: v.data.orderId });
    return { ok: true };
  });
}

// ── Menu ────────────────────────────────────────────────────────────────────
function refreshMenu() {
  revalidateTag(CACHE_TAGS.menu);
  revalidateTag(CACHE_TAGS.offers);
}

export async function toggleSoldOutAction(raw: unknown): Promise<Result> {
  return guarded(["owner", "manager", "kitchen"], async () => {
    const v = z.object({ itemId: z.string().uuid(), soldOut: z.boolean() }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const db = await getDb();
    // Only this one column — kitchen staff can never touch prices.
    await db.update(s.menuItems).set({ isSoldOut: v.data.soldOut }).where(eq(s.menuItems.id, v.data.itemId));
    refreshMenu();
    return { ok: true };
  });
}

export async function setItemActiveAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async () => {
    const v = z.object({ itemId: z.string().uuid(), active: z.boolean() }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const db = await getDb();
    await db.update(s.menuItems).set({ isActive: v.data.active }).where(eq(s.menuItems.id, v.data.itemId));
    refreshMenu();
    return { ok: true };
  });
}

const money = z.coerce.number().min(0).max(100_000).transform((v) => Math.round(v * 100));
const itemSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,80}$/),
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  descriptionAr: z.string().trim().max(500).optional().default(""),
  descriptionEn: z.string().trim().max(500).optional().default(""),
  price: money,
  isSpicy: z.boolean(),
  isVegetarian: z.boolean(),
  isBestSeller: z.boolean(),
  isFeatured: z.boolean(),
  sizes: z
    .array(z.object({ nameAr: z.string().trim().min(1).max(40), nameEn: z.string().trim().min(1).max(40), price: money }))
    .max(6)
    .default([]),
  addonGroupIds: z.array(z.string().uuid()).max(10).default([]),
});

export async function saveMenuItemAction(form: FormData): Promise<Result<{ id: string }>> {
  return guarded(MANAGERS, async () => {
    let payload: unknown;
    try {
      payload = JSON.parse(String(form.get("payload") ?? "{}"));
    } catch {
      return { ok: false, error: "VALIDATION" };
    }
    const v = itemSchema.safeParse(payload);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const d = v.data;
    const db = await getDb();
    const [clash] = await db
      .select({ id: s.menuItems.id })
      .from(s.menuItems)
      .where(d.id ? and(eq(s.menuItems.slug, d.slug), ne(s.menuItems.id, d.id)) : eq(s.menuItems.slug, d.slug))
      .limit(1);
    if (clash) return { ok: false, error: "SLUG_TAKEN" };

    let imageUrl: string | undefined;
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) return { ok: false, error: "IMAGE" };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniffImage(bytes);
      if (!kind || kind.ext === "heic") return { ok: false, error: "IMAGE" };
      const key = `items/${d.slug}-${Date.now()}.${kind.ext}`;
      await storage().put("menu-images", key, bytes, kind.type);
      imageUrl = storage().url("menu-images", key);
    }

    const values = {
      categoryId: d.categoryId,
      slug: d.slug,
      nameAr: d.nameAr,
      nameEn: d.nameEn,
      descriptionAr: d.descriptionAr || null,
      descriptionEn: d.descriptionEn || null,
      basePricePiasters: d.sizes[0]?.price ?? d.price,
      isSpicy: d.isSpicy,
      isVegetarian: d.isVegetarian,
      isBestSeller: d.isBestSeller,
      isFeatured: d.isFeatured,
      ...(imageUrl ? { imageUrl } : {}),
    };
    const id = await db.transaction(async (tx) => {
      let itemId = d.id || "";
      if (itemId) {
        await tx.update(s.menuItems).set(values).where(eq(s.menuItems.id, itemId));
      } else {
        const [row] = await tx.insert(s.menuItems).values({ ...values, sortOrder: 999 }).returning({ id: s.menuItems.id });
        itemId = row!.id;
      }
      // Sizes: replace. Existing order_items keep their snapshots (FK is "set null").
      await tx.delete(s.itemSizes).where(eq(s.itemSizes.menuItemId, itemId));
      if (d.sizes.length) {
        await tx.insert(s.itemSizes).values(
          d.sizes.map((z, i) => ({ menuItemId: itemId, nameAr: z.nameAr, nameEn: z.nameEn, pricePiasters: z.price, isDefault: i === 0, sortOrder: i })),
        );
      }
      await tx.delete(s.menuItemAddonGroups).where(eq(s.menuItemAddonGroups.menuItemId, itemId));
      if (d.addonGroupIds.length) {
        await tx.insert(s.menuItemAddonGroups).values(d.addonGroupIds.map((g, i) => ({ menuItemId: itemId, addonGroupId: g, sortOrder: i })));
      }
      return itemId;
    });
    refreshMenu();
    revalidatePath("/[locale]/admin/menu", "page");
    return { ok: true, data: { id } };
  });
}

// ── InstaPay ────────────────────────────────────────────────────────────────
export async function reviewInstapayAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async (session) => {
    const v = z.object({ paymentId: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(200).optional() }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const ok = await reviewInstapay(v.data.paymentId, v.data.approve, session.userId, v.data.note || null);
    revalidatePath("/[locale]/admin/instapay", "page");
    return ok ? { ok: true } : { ok: false, error: "NOT_PENDING" };
  });
}

// ── Settings ────────────────────────────────────────────────────────────────
const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/),
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  fee: money,
  minOrder: money,
  etaMin: z.coerce.number().int().min(1).max(300),
  etaMax: z.coerce.number().int().min(1).max(300),
  isActive: z.boolean(),
});

export async function saveZonesAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async () => {
    const v = z.array(zoneSchema).max(50).safeParse(raw);
    if (!v.success || v.data.some((z) => z.etaMax < z.etaMin)) return { ok: false, error: "VALIDATION" };
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const [i, z] of v.data.entries()) {
        const values = {
          slug: z.slug,
          nameAr: z.nameAr,
          nameEn: z.nameEn,
          feePiasters: z.fee,
          minOrderPiasters: z.minOrder,
          etaMinMinutes: z.etaMin,
          etaMaxMinutes: z.etaMax,
          isActive: z.isActive,
          sortOrder: i,
        };
        if (z.id) await tx.update(s.deliveryZones).set(values).where(eq(s.deliveryZones.id, z.id));
        else await tx.insert(s.deliveryZones).values(values);
      }
    });
    revalidateTag(CACHE_TAGS.zones);
    return { ok: true };
  });
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export async function saveHoursAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async () => {
    const v = z
      .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), opensAt: time, closesAt: time, isClosed: z.boolean() }))
      .length(7)
      .safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const h of v.data) {
        await tx
          .insert(s.openingHours)
          .values(h)
          .onConflictDoUpdate({ target: s.openingHours.dayOfWeek, set: { opensAt: h.opensAt, closesAt: h.closesAt, isClosed: h.isClosed } });
      }
    });
    revalidateTag(CACHE_TAGS.settings);
    return { ok: true };
  });
}

type SettingKey = keyof typeof settingsSchemas;
export async function saveSettingAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async (session) => {
    const v = z.object({ key: z.enum(["vat", "ordering", "payments", "instapay", "restaurant", "notifications"]), value: z.unknown() }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const key = v.data.key as SettingKey;
    let value = settingsSchemas[key].safeParse(v.data.value);
    if (!value.success) return { ok: false, error: "VALIDATION" };
    if (key === "notifications") {
      const phone = normalizeEgyptianPhone((value.data as { restaurantAlertPhone: string }).restaurantAlertPhone);
      if (!EG_MOBILE_REGEX.test(phone)) return { ok: false, error: "VALIDATION" };
      value = { success: true, data: { restaurantAlertPhone: phone } } as typeof value;
    }
    const db = await getDb();
    await db
      .insert(s.settings)
      .values({ key, value: value.data as object, isPublic: key !== "notifications", updatedBy: session.userId })
      .onConflictDoUpdate({ target: s.settings.key, set: { value: value.data as object, updatedBy: session.userId } });
    revalidateTag(CACHE_TAGS.settings);
    return { ok: true };
  });
}

export async function savePromoAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async () => {
    const v = z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/),
        discountType: z.enum(["percent", "fixed"]),
        value: z.coerce.number().positive().max(100_000),
        maxDiscount: z.coerce.number().min(0).max(100_000).optional(),
        minSubtotal: z.coerce.number().min(0).max(100_000).default(0),
        perPhoneLimit: z.coerce.number().int().min(0).max(1000).optional(),
        endsAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
        isActive: z.boolean().default(true),
        descriptionAr: z.string().trim().max(200).optional(),
        descriptionEn: z.string().trim().max(200).optional(),
      })
      .refine((p) => p.discountType !== "percent" || p.value <= 100)
      .safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const p = v.data;
    const values = {
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountType === "percent" ? Math.round(p.value) : Math.round(p.value * 100),
      maxDiscountPiasters: p.maxDiscount ? Math.round(p.maxDiscount * 100) : null,
      minSubtotalPiasters: Math.round(p.minSubtotal * 100),
      perPhoneLimit: p.perPhoneLimit || null,
      endsAt: p.endsAt ? new Date(p.endsAt) : null,
      isActive: p.isActive,
      descriptionAr: p.descriptionAr || null,
      descriptionEn: p.descriptionEn || null,
    };
    const db = await getDb();
    const [clash] = await db.select({ id: s.promoCodes.id }).from(s.promoCodes).where(eq(s.promoCodes.code, p.code)).limit(1);
    if (clash && clash.id !== p.id) return { ok: false, error: "EXISTS" };
    if (p.id) await db.update(s.promoCodes).set(values).where(eq(s.promoCodes.id, p.id));
    else await db.insert(s.promoCodes).values(values);
    revalidatePath("/[locale]/admin/settings", "page");
    return { ok: true };
  });
}

export async function toggleOfferAction(raw: unknown): Promise<Result> {
  return guarded(MANAGERS, async () => {
    const v = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const db = await getDb();
    await db.update(s.offers).set({ isActive: v.data.active }).where(eq(s.offers.id, v.data.id));
    revalidateTag(CACHE_TAGS.offers);
    return { ok: true };
  });
}

// ── Staff & roles (owner only) ──────────────────────────────────────────────
export async function addStaffAction(raw: unknown): Promise<Result> {
  return guarded(["owner"], async (session) => {
    const v = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().toLowerCase().email().max(254),
        password: z.string().max(200).optional().default(""),
        role: z.enum(["owner", "manager", "kitchen", "driver"]),
      })
      .safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    const d = v.data;
    const db = await getDb();
    let [profile] = await db.select().from(s.profiles).where(eq(s.profiles.email, d.email)).limit(1);
    let existed = Boolean(profile);
    if (!profile) {
      if (d.password.length < 10) return { ok: false, error: "WEAK" };
      if (isSupabaseConfigured()) {
        const e = env();
        const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
        const { data, error } = await admin.auth.admin.createUser({ email: d.email, password: d.password, email_confirm: true, user_metadata: { full_name: d.name } });
        if (error || !data.user) return { ok: false, error: "SERVER" };
      } else {
        await db.insert(s.authUsers).values({ email: d.email, encryptedPassword: await hashPassword(d.password), rawUserMetaData: { full_name: d.name } });
      }
      [profile] = await db.select().from(s.profiles).where(eq(s.profiles.email, d.email)).limit(1);
      existed = false;
    }
    if (!profile) return { ok: false, error: "SERVER" };
    await db.update(s.profiles).set({ fullName: profile.fullName ?? d.name }).where(eq(s.profiles.id, profile.id));
    await db.insert(s.userRoles).values({ userId: profile.id, roleKey: d.role, grantedBy: session.userId }).onConflictDoNothing();
    revalidatePath("/[locale]/admin/staff", "page");
    return existed ? { ok: false, error: "EXISTS" } : { ok: true };
  });
}

export async function removeRoleAction(raw: unknown): Promise<Result> {
  return guarded(["owner"], async (session) => {
    const v = z.object({ userId: z.string().uuid(), role: z.enum(["owner", "manager", "kitchen", "driver"]) }).safeParse(raw);
    if (!v.success) return { ok: false, error: "VALIDATION" };
    if (v.data.userId === session.userId && v.data.role === "owner") return { ok: false, error: "SELF" };
    const db = await getDb();
    await db.delete(s.userRoles).where(and(eq(s.userRoles.userId, v.data.userId), eq(s.userRoles.roleKey, v.data.role)));
    revalidatePath("/[locale]/admin/staff", "page");
    return { ok: true };
  });
}


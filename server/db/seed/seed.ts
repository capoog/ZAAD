/**
 * Idempotent-ish seeder: run on an empty database (after migrations).
 * Orders are priced with the same engine the checkout uses, so every seeded
 * total satisfies the database's own consistency checks.
 */
import { eq } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { egp } from "../../../lib/money";
import { fromCairoWallClock, toCairoWallClock } from "../../../lib/hours";
import { priceOrder, type CartLineInput, type PricingMenuItem } from "../../../lib/pricing";
import type { OrderStatus } from "../../../lib/order-status";
import { hashPassword } from "../../auth/password";
import type { DbHandle } from "../core";
import * as s from "../schema";
import * as data from "./data";

type Log = (msg: string) => void;

export interface SeedOptions {
  /** When seeding a Supabase project, users are created through the Admin API. */
  supabaseAdmin?: SupabaseClient | null;
  log?: Log;
  now?: Date;
}

/** Small deterministic PRNG so the demo data is stable between runs. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function createAuthUser(
  h: DbHandle,
  opts: SeedOptions,
  user: { email?: string; phone?: string; password?: string; fullName: string },
): Promise<string> {
  if (opts.supabaseAdmin) {
    const { data: created, error } = await opts.supabaseAdmin.auth.admin.createUser({
      email: user.email,
      phone: user.phone ? `+2${user.phone}` : undefined,
      password: user.password,
      email_confirm: Boolean(user.email),
      phone_confirm: Boolean(user.phone),
      user_metadata: { full_name: user.fullName },
    });
    if (error || !created.user) throw new Error(`Supabase createUser failed: ${error?.message}`);
    // The on_auth_user_created trigger creates the profile; make sure name/phone are set.
    await h.db
      .update(s.profiles)
      .set({ fullName: user.fullName, phone: user.phone ?? null, email: user.email ?? null })
      .where(eq(s.profiles.id, created.user.id));
    return created.user.id;
  }
  const [row] = await h.db
    .insert(s.authUsers)
    .values({
      email: user.email ?? null,
      phone: user.phone ?? null,
      encryptedPassword: user.password ? await hashPassword(user.password) : null,
      rawUserMetaData: { full_name: user.fullName },
    })
    .returning({ id: s.authUsers.id });
  if (!row) throw new Error("auth user insert failed");
  return row.id;
}

export async function seed(h: DbHandle, opts: SeedOptions = {}): Promise<void> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? new Date();
  const db = h.db;

  // ── Roles ───────────────────────────────────────────────────────────────
  await db
    .insert(s.roles)
    .values([
      { key: "owner", nameAr: "المالك", nameEn: "Owner", rank: 1, description: "Full access incl. staff & settings" },
      { key: "manager", nameAr: "مدير", nameEn: "Manager", rank: 2, description: "Menu, orders, promos, analytics" },
      { key: "kitchen", nameAr: "المطبخ", nameEn: "Kitchen", rank: 3, description: "Live orders board & sold-out" },
      { key: "driver", nameAr: "الطيار", nameEn: "Driver", rank: 4, description: "Assigned deliveries" },
    ])
    .onConflictDoNothing();

  // ── Menu ────────────────────────────────────────────────────────────────
  log("menu");
  const catRows = await db
    .insert(s.categories)
    .values(data.categories.map((c, i) => ({ ...c, sortOrder: i })))
    .returning({ id: s.categories.id, slug: s.categories.slug });
  const catId = new Map(catRows.map((c) => [c.slug, c.id]));

  const groupId = new Map<string, string>();
  for (const [gi, g] of data.addonGroups.entries()) {
    const [row] = await db
      .insert(s.addonGroups)
      .values({ slug: g.slug, nameAr: g.nameAr, nameEn: g.nameEn, minSelect: g.minSelect, maxSelect: g.maxSelect, sortOrder: gi })
      .returning({ id: s.addonGroups.id });
    if (!row) throw new Error("addon group insert failed");
    groupId.set(g.slug, row.id);
    await db.insert(s.addons).values(
      g.addons.map((a, ai) => ({ groupId: row.id, nameAr: a.nameAr, nameEn: a.nameEn, pricePiasters: egp(a.price), sortOrder: ai })),
    );
  }

  for (const [i, it] of data.items.entries()) {
    const categoryId = catId.get(it.category);
    if (!categoryId) throw new Error(`unknown category ${it.category}`);
    const [row] = await db
      .insert(s.menuItems)
      .values({
        categoryId,
        slug: it.slug,
        nameAr: it.nameAr,
        nameEn: it.nameEn,
        descriptionAr: it.descriptionAr,
        descriptionEn: it.descriptionEn,
        basePricePiasters: egp(it.price),
        imageUrl: it.imageUrl,
        isSpicy: it.spicy ?? false,
        isVegetarian: it.vegetarian ?? false,
        isBestSeller: it.bestSeller ?? false,
        isFeatured: it.featured ?? false,
        sortOrder: i,
      })
      .returning({ id: s.menuItems.id });
    if (!row) throw new Error("menu item insert failed");
    if (it.sizes?.length) {
      await db.insert(s.itemSizes).values(
        it.sizes.map((z, zi) => ({
          menuItemId: row.id,
          nameAr: z.nameAr,
          nameEn: z.nameEn,
          pricePiasters: egp(z.price),
          isDefault: z.isDefault ?? false,
          sortOrder: zi,
        })),
      );
    }
    if (it.addonGroups?.length) {
      await db.insert(s.menuItemAddonGroups).values(
        it.addonGroups.map((slug, gi) => ({ menuItemId: row.id, addonGroupId: groupId.get(slug)!, sortOrder: gi })),
      );
    }
  }

  // ── Zones, hours, settings ──────────────────────────────────────────────
  log("zones & settings");
  const zoneRows = await db
    .insert(s.deliveryZones)
    .values(
      data.zones.map((z, i) => ({
        slug: z.slug,
        nameAr: z.nameAr,
        nameEn: z.nameEn,
        feePiasters: egp(z.fee),
        minOrderPiasters: egp(z.minOrder),
        etaMinMinutes: z.eta[0],
        etaMaxMinutes: z.eta[1],
        sortOrder: i,
      })),
    )
    .returning();

  await db
    .insert(s.openingHours)
    .values([0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opensAt: "12:00", closesAt: "02:00", isClosed: false })));

  await db.insert(s.settings).values([
    { key: "restaurant", isPublic: true, value: data.RESTAURANT },
    { key: "vat", isPublic: true, value: { rateBps: 1400, pricesIncludeVat: true } },
    {
      key: "ordering",
      isPublic: true,
      value: {
        acceptingOrders: true,
        allowScheduledWhenClosed: true,
        minScheduleLeadMinutes: 45,
        maxScheduleDays: 3,
        pickupEtaMinutes: 20,
      },
    },
    {
      key: "payments",
      isPublic: true,
      value: { cash: true, card: true, wallet: true, fawry: true, valu: true, instapay: true },
    },
    {
      key: "instapay",
      isPublic: true,
      value: { enabled: true, handle: "fahmzaatar@instapay", accountName: "Fahm & Zaatar" },
    },
    { key: "notifications", isPublic: false, value: { restaurantAlertPhone: data.RESTAURANT.phone } },
  ]);

  // ── Promo & offers ──────────────────────────────────────────────────────
  const [welcome] = await db
    .insert(s.promoCodes)
    .values({
      code: "WELCOME10",
      descriptionAr: "خصم 10% على أول أوردر",
      descriptionEn: "10% off your first order",
      discountType: "percent",
      discountValue: 10,
      minSubtotalPiasters: 0,
      perPhoneLimit: 1,
    })
    .returning();
  if (!welcome) throw new Error("promo insert failed");

  const itemRows = await db.select().from(s.menuItems);
  const itemBySlug = new Map(itemRows.map((r) => [r.slug, r]));
  await db.insert(s.offers).values([
    {
      titleAr: "خصم 10% على أول أوردر",
      titleEn: "10% off your first order",
      subtitleAr: "استخدم الكود WELCOME10 وأنت بتطلب",
      subtitleEn: "Use code WELCOME10 at checkout",
      badgeAr: "كود خصم",
      badgeEn: "Promo code",
      imageUrl: data.PHOTOS.hero,
      promoCodeId: welcome.id,
      sortOrder: 0,
    },
    {
      titleAr: "عزومة على الفحم لفردين",
      titleEn: "A charcoal feast for two",
      subtitleAr: "طاجن مشكل مشويات بـ 650 ج.م بس",
      subtitleEn: "Mixed grill platter for just EGP 650",
      badgeAr: "الأكثر طلباً",
      badgeEn: "Most loved",
      imageUrl: data.PHOTOS.mixedGrill,
      menuItemId: itemBySlug.get("mixed-grill-platter")?.id ?? null,
      sortOrder: 1,
    },
    {
      titleAr: "كنافة نابلسية سخنة",
      titleEn: "Hot Nabulsi kunafa",
      subtitleAr: "ختامها مسك بعد أي أكلة",
      subtitleEn: "The perfect ending to any meal",
      badgeAr: "حلو",
      badgeEn: "Dessert",
      imageUrl: data.art("nabulsi-kunafa"),
      menuItemId: itemBySlug.get("nabulsi-kunafa")?.id ?? null,
      sortOrder: 2,
    },
  ]);

  // ── Staff & demo customers ──────────────────────────────────────────────
  log("staff accounts");
  const staffIds = new Map<string, string>();
  for (const st of data.staff) {
    const id = await createAuthUser(h, opts, {
      email: st.email,
      phone: st.phone,
      password: data.DEMO_STAFF_PASSWORD,
      fullName: st.fullName,
    });
    staffIds.set(st.role, id);
    await db.insert(s.userRoles).values({ userId: id, roleKey: st.role });
  }

  const customerIds = new Map<string, string>();
  for (const c of data.customers.slice(0, 2)) {
    customerIds.set(c.phone, await createAuthUser(h, opts, { phone: c.phone, fullName: c.name }));
  }

  // ── Reviews ─────────────────────────────────────────────────────────────
  await db.insert(s.reviews).values(
    data.reviews.map((r, i) => ({
      customerName: r.name,
      rating: r.rating,
      comment: r.comment,
      locale: r.locale,
      isPublished: true,
      createdAt: new Date(now.getTime() - (i + 1) * 86400000 * 2),
    })),
  );

  // ── 15 sample orders ────────────────────────────────────────────────────
  log("sample orders");
  const pricingItems = await loadPricingItems(h);
  const bySlug = new Map([...pricingItems.values()].map((p) => [itemRows.find((r) => r.id === p.id)!.slug, p]));
  const zoneBySlug = new Map(zoneRows.map((z) => [z.slug, z]));
  const rand = mulberry32(20261121);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

  const line = (slug: string, qty: number, opts2: { size?: number; addons?: number[] } = {}): CartLineInput => {
    const p = bySlug.get(slug);
    if (!p) throw new Error(`unknown item ${slug}`);
    const allAddons = p.addonGroups.flatMap((g) => g.addons);
    return {
      menuItemId: p.id,
      sizeId: p.sizes.length ? (p.sizes[opts2.size ?? 0]?.id ?? null) : null,
      addonIds: (opts2.addons ?? []).map((i) => allAddons[i]?.id).filter((x): x is string => Boolean(x)),
      quantity: qty,
    };
  };

  const baskets: CartLineInput[][] = [
    [line("grilled-kofta", 1, { size: 1, addons: [0] }), line("hummus", 1), line("lemon-mint", 2)],
    [line("chicken-shawarma-arabi", 2), line("soft-drink-can", 2)],
    [line("mixed-grill-platter", 1, { addons: [1] }), line("tabbouleh", 1), line("nabulsi-kunafa", 2)],
    [line("chicken-shawarma-sandwich", 3, { addons: [0] }), line("french-fries", 2)],
    [line("shish-tawook", 2, { addons: [2] }), line("baba-ghanoush", 1), line("mango-juice", 2)],
    [line("lamb-chops", 1, { size: 1 }), line("hummus", 1), line("om-ali", 1)],
    [line("beef-shawarma-sandwich", 2, { addons: [1] }), line("cheese-manakish", 1), line("mineral-water", 2)],
    [line("shawarma-fatteh", 2), line("lemon-mint", 2)],
    [line("grilled-kofta", 2), line("french-fries", 1), line("soft-drink-can", 2)],
    [line("minced-meat-pie", 2), line("zaatar-manakish", 2), line("tabbouleh", 1)],
    [line("mixed-grill-platter", 2), line("hummus", 2), line("nabulsi-kunafa", 3), line("mango-juice", 4)],
    [line("chicken-shawarma-arabi", 1), line("nabulsi-kunafa", 1)],
    [line("shish-tawook", 1), line("chicken-shawarma-sandwich", 2), line("lemon-mint", 1)],
    [line("lamb-chops", 1), line("grilled-kofta", 1), line("baba-ghanoush", 1), line("mineral-water", 2)],
    [line("chicken-shawarma-sandwich", 2), line("beef-shawarma-sandwich", 1), line("french-fries", 1)],
  ];

  type Plan = {
    daysAgo: number;
    minutesAgo?: number;
    hour?: number;
    status: OrderStatus;
    method: s.PaymentMethod;
    zone: string | null;
    promo?: boolean;
  };
  // Today's live orders first (so the kitchen board has something to show), then history.
  const plans: Plan[] = [
    { daysAgo: 0, minutesAgo: 6, status: "received", method: "cash", zone: "fifth-settlement" },
    { daysAgo: 0, minutesAgo: 18, status: "preparing", method: "card", zone: "rehab" },
    { daysAgo: 0, minutesAgo: 34, status: "out_for_delivery", method: "wallet", zone: "madinaty" },
    { daysAgo: 0, minutesAgo: 9, status: "pending_payment", method: "instapay", zone: "nasr-city" },
    { daysAgo: 1, hour: 21, status: "delivered", method: "cash", zone: "fifth-settlement", promo: true },
    { daysAgo: 1, hour: 14, status: "delivered", method: "card", zone: "first-third-settlement" },
    { daysAgo: 2, hour: 20, status: "delivered", method: "cash", zone: null },
    { daysAgo: 3, hour: 23, status: "delivered", method: "instapay", zone: "fifth-settlement" },
    { daysAgo: 4, hour: 15, status: "cancelled", method: "cash", zone: "madinaty" },
    { daysAgo: 5, hour: 19, status: "delivered", method: "fawry", zone: "nasr-city" },
    { daysAgo: 6, hour: 21, status: "delivered", method: "cash", zone: "rehab" },
    { daysAgo: 8, hour: 0, status: "delivered", method: "valu", zone: "fifth-settlement" },
    { daysAgo: 9, hour: 13, status: "delivered", method: "cash", zone: "first-third-settlement" },
    { daysAgo: 11, hour: 22, status: "delivered", method: "card", zone: "fifth-settlement" },
    { daysAgo: 13, hour: 20, status: "delivered", method: "cash", zone: "madinaty" },
  ];

  const vat = { rateBps: 1400, pricesIncludeVat: true };
  const today = toCairoWallClock(now);
  const landmarks = ["جنب مول ووترواي", "قدام بوابة 3", "ورا الجامعة الأمريكية", "جنب صيدلية العزبي", "أول شارع التسعين"];
  const streets = ["شارع التسعين الشمالي", "شارع محمد نجيب", "شارع النرجس 2", "شارع الياسمين", "شارع عباس العقاد"];

  for (const [i, plan] of plans.entries()) {
    const basket = baskets[i]!;
    const customer = data.customers[i % data.customers.length]!;
    const zone = plan.zone ? zoneBySlug.get(plan.zone)! : null;
    let placedAt: Date;
    if (plan.minutesAgo !== undefined) placedAt = new Date(now.getTime() - plan.minutesAgo * 60000);
    else {
      const d = new Date(Date.UTC(today.year, today.month - 1, today.day - plan.daysAgo));
      const hour = plan.hour ?? 20;
      placedAt = fromCairoWallClock(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, Math.floor(rand() * 55));
    }

    const priced = priceOrder({
      lines: basket,
      items: pricingItems,
      fulfillment: zone ? "delivery" : "pickup",
      zone: zone ? { id: zone.id, feePiasters: zone.feePiasters, minOrderPiasters: zone.minOrderPiasters } : null,
      promo: plan.promo
        ? {
            id: welcome.id,
            code: welcome.code,
            discountType: welcome.discountType,
            discountValue: welcome.discountValue,
            maxDiscountPiasters: welcome.maxDiscountPiasters,
            minSubtotalPiasters: welcome.minSubtotalPiasters,
          }
        : null,
      vat,
    });
    if (priced.errors.length) throw new Error(`seed basket ${i} invalid: ${JSON.stringify(priced.errors)}`);

    const paid =
      plan.status === "delivered" || (plan.method !== "cash" && plan.method !== "instapay" && plan.status !== "cancelled");
    const paymentStatus: s.PaymentStatus =
      plan.status === "cancelled"
        ? "cancelled"
        : plan.method === "instapay" && plan.status === "pending_payment"
          ? "pending_review"
          : paid
            ? "paid"
            : "unpaid";

    const [order] = await db
      .insert(s.orders)
      .values({
        userId: customerIds.get(customer.phone) ?? null,
        customerName: customer.name,
        customerPhone: customer.phone,
        fulfillmentType: zone ? "delivery" : "pickup",
        zoneId: zone?.id ?? null,
        addressStreet: zone ? pick(streets) : null,
        addressBuilding: zone ? String(10 + Math.floor(rand() * 90)) : null,
        addressFloor: zone ? String(1 + Math.floor(rand() * 8)) : null,
        addressApartment: zone ? String(1 + Math.floor(rand() * 20)) : null,
        addressLandmark: zone ? pick(landmarks) : null,
        status: plan.status,
        paymentMethod: plan.method,
        paymentStatus,
        subtotalPiasters: priced.subtotalPiasters,
        discountPiasters: priced.discountPiasters,
        deliveryFeePiasters: priced.deliveryFeePiasters,
        vatPiasters: priced.vatPiasters,
        totalPiasters: priced.totalPiasters,
        vatRateBps: priced.vatRateBps,
        pricesIncludeVat: priced.pricesIncludeVat,
        promoCodeId: priced.promo?.id ?? null,
        promoCode: priced.promo?.code ?? null,
        notes: i === 0 ? "من غير بصل لو سمحت" : null,
        cancelReason: plan.status === "cancelled" ? "العميل لغى الطلب" : null,
        assignedDriverId: plan.status === "out_for_delivery" ? (staffIds.get("driver") ?? null) : null,
        placedAt,
        createdAt: placedAt,
      })
      .returning();
    if (!order) throw new Error("order insert failed");

    for (const l of priced.lines) {
      const [oi] = await db
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
      if (l.addons.length && oi) {
        await db.insert(s.orderItemAddons).values(
          l.addons.map((a) => ({ orderItemId: oi.id, addonId: a.id, nameAr: a.nameAr, nameEn: a.nameEn, pricePiasters: a.pricePiasters })),
        );
      }
    }

    // Replace the trigger's single history row with a realistic timeline.
    await db.delete(s.orderStatusHistory).where(eq(s.orderStatusHistory.orderId, order.id));
    const steps: OrderStatus[] = zone
      ? ["received", "preparing", "out_for_delivery", "delivered"]
      : ["received", "preparing", "ready_for_pickup", "delivered"];
    const flow: OrderStatus[] =
      plan.status === "pending_payment"
        ? ["pending_payment"]
        : plan.status === "cancelled"
          ? ["received", "cancelled"]
          : steps.slice(0, steps.indexOf(plan.status) + 1);
    const gaps = [0, 4, 22, 24];
    let t = placedAt.getTime();
    let prev: OrderStatus | null = null;
    for (const [fi, st] of flow.entries()) {
      t += (gaps[fi] ?? 10) * 60000;
      const at = new Date(Math.min(t, now.getTime()));
      await db.insert(s.orderStatusHistory).values({
        orderId: order.id,
        fromStatus: prev,
        toStatus: st,
        changedBy: fi === 0 ? null : (staffIds.get(st === "delivered" && zone ? "driver" : "kitchen") ?? null),
        createdAt: at,
      });
      prev = st;
    }

    await db.insert(s.payments).values({
      orderId: order.id,
      provider: plan.method === "cash" ? "cod" : plan.method === "instapay" ? "instapay" : "paymob",
      method: plan.method,
      status: paymentStatus === "unpaid" ? "pending" : paymentStatus,
      amountPiasters: priced.totalPiasters,
      providerRef: ["card", "wallet", "fawry", "valu"].includes(plan.method) ? `MOCK-TXN-${100000 + i}` : null,
      proofPath: plan.method === "instapay" ? "demo/instapay-proof.svg" : null,
      payerReference: plan.method === "instapay" ? customer.name : null,
      reviewedAt: plan.method === "instapay" && paymentStatus === "paid" ? placedAt : null,
      reviewedBy: plan.method === "instapay" && paymentStatus === "paid" ? (staffIds.get("manager") ?? null) : null,
      createdAt: placedAt,
    });

    if (plan.promo && priced.promo) {
      await db.update(s.promoCodes).set({ timesUsed: 1 }).where(eq(s.promoCodes.id, priced.promo.id));
    }
  }
  log("done");
}

/** Load the menu in the shape the pricing engine needs. */
export async function loadPricingItems(h: DbHandle): Promise<Map<string, PricingMenuItem>> {
  const db = h.db;
  const [items, sizes, links, groups, addonRows] = await Promise.all([
    db.select().from(s.menuItems),
    db.select().from(s.itemSizes),
    db.select().from(s.menuItemAddonGroups),
    db.select().from(s.addonGroups),
    db.select().from(s.addons),
  ]);
  const map = new Map<string, PricingMenuItem>();
  for (const it of items) {
    const itemGroups = links
      .filter((l) => l.menuItemId === it.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => groups.find((g) => g.id === l.addonGroupId))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    map.set(it.id, {
      id: it.id,
      nameAr: it.nameAr,
      nameEn: it.nameEn,
      basePricePiasters: it.basePricePiasters,
      isActive: it.isActive,
      isSoldOut: it.isSoldOut,
      sizes: sizes
        .filter((z) => z.menuItemId === it.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((z) => ({ id: z.id, nameAr: z.nameAr, nameEn: z.nameEn, pricePiasters: z.pricePiasters, isDefault: z.isDefault })),
      addonGroups: itemGroups.map((g) => ({
        id: g.id,
        nameAr: g.nameAr,
        nameEn: g.nameEn,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        addons: addonRows
          .filter((a) => a.groupId === g.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((a) => ({ id: a.id, nameAr: a.nameAr, nameEn: a.nameEn, pricePiasters: a.pricePiasters, isAvailable: a.isAvailable })),
      })),
    });
  }
  return map;
}


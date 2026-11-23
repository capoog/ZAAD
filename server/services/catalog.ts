import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { getDb } from "../db";
import * as s from "../db/schema";
import type {
  MenuCategory,
  MenuItem,
  Offer,
  OpeningHour,
  PublicSettings,
  Review,
  Zone,
} from "@/types/catalog";

/**
 * Server-side cache. Skipped for the embedded (PGlite) database: on serverless
 * hosts each instance has its own throw-away copy, so a shared cache could
 * serve IDs that don't exist in this instance.
 */
function cached<T>(fn: () => Promise<T>, key: string[], opts: { tags: string[]; revalidate: number }): () => Promise<T> {
  if (!process.env.DATABASE_URL) return fn;
  return unstable_cache(fn, key, opts);
}

export const CACHE_TAGS = { menu: "menu", settings: "settings", zones: "zones", offers: "offers", reviews: "reviews" } as const;

// ── Settings (validated: the DB stores jsonb) ─────────────────────────────────
export const settingsSchemas = {
  restaurant: z.object({
    nameAr: z.string(),
    nameEn: z.string(),
    phone: z.string(),
    whatsapp: z.string(),
    addressAr: z.string(),
    addressEn: z.string(),
    lat: z.number(),
    lng: z.number(),
    instagram: z.string().optional(),
  }),
  vat: z.object({ rateBps: z.number().int().min(0).max(10000), pricesIncludeVat: z.boolean() }),
  ordering: z.object({
    acceptingOrders: z.boolean(),
    allowScheduledWhenClosed: z.boolean(),
    minScheduleLeadMinutes: z.number().int().min(0).max(1440),
    maxScheduleDays: z.number().int().min(0).max(14),
    pickupEtaMinutes: z.number().int().min(5).max(180),
  }),
  payments: z.object({
    cash: z.boolean(),
    card: z.boolean(),
    wallet: z.boolean(),
    fawry: z.boolean(),
    valu: z.boolean(),
    instapay: z.boolean(),
  }),
  instapay: z.object({ enabled: z.boolean(), handle: z.string().max(60), accountName: z.string().max(60) }),
  notifications: z.object({ restaurantAlertPhone: z.string() }),
} as const;

async function loadSettings(): Promise<PublicSettings> {
  const db = await getDb();
  const [rows, hours] = await Promise.all([
    db.select().from(s.settings),
    db.select().from(s.openingHours).orderBy(asc(s.openingHours.dayOfWeek)),
  ]);
  const get = <K extends keyof typeof settingsSchemas>(key: K) => {
    const row = rows.find((r) => r.key === key);
    return settingsSchemas[key].parse(row?.value) as z.infer<(typeof settingsSchemas)[K]>;
  };
  return {
    restaurant: get("restaurant"),
    vat: get("vat"),
    ordering: get("ordering"),
    payments: get("payments"),
    instapay: get("instapay"),
    hours: hours.map<OpeningHour>((h) => ({
      dayOfWeek: h.dayOfWeek,
      opensAt: h.opensAt.slice(0, 5),
      closesAt: h.closesAt.slice(0, 5),
      isClosed: h.isClosed,
    })),
  };
}

export const getPublicSettings = cached(loadSettings, ["public-settings"], {
  tags: [CACHE_TAGS.settings],
  revalidate: 300,
});

// ── Menu ─────────────────────────────────────────────────────────────────────
async function loadMenu(includeInactive = false): Promise<MenuCategory[]> {
  const db = await getDb();
  const [cats, items, sizes, links, groups, addonRows] = await Promise.all([
    db.select().from(s.categories).orderBy(asc(s.categories.sortOrder)),
    db.select().from(s.menuItems).orderBy(asc(s.menuItems.sortOrder)),
    db.select().from(s.itemSizes).orderBy(asc(s.itemSizes.sortOrder)),
    db.select().from(s.menuItemAddonGroups).orderBy(asc(s.menuItemAddonGroups.sortOrder)),
    db.select().from(s.addonGroups),
    db.select().from(s.addons).orderBy(asc(s.addons.sortOrder)),
  ]);

  const groupMap = new Map(
    groups.map((g) => [
      g.id,
      {
        id: g.id,
        slug: g.slug,
        nameAr: g.nameAr,
        nameEn: g.nameEn,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        addons: addonRows
          .filter((a) => a.groupId === g.id)
          .map((a) => ({ id: a.id, nameAr: a.nameAr, nameEn: a.nameEn, pricePiasters: a.pricePiasters, isAvailable: a.isAvailable })),
      },
    ]),
  );

  return cats
    .filter((c) => includeInactive || c.isActive)
    .map<MenuCategory>((c) => ({
      id: c.id,
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      descriptionAr: c.descriptionAr,
      descriptionEn: c.descriptionEn,
      imageUrl: c.imageUrl,
      items: items
        .filter((i) => i.categoryId === c.id && (includeInactive || i.isActive))
        .map<MenuItem>((i) => ({
          id: i.id,
          slug: i.slug,
          categoryId: c.id,
          categorySlug: c.slug,
          nameAr: i.nameAr,
          nameEn: i.nameEn,
          descriptionAr: i.descriptionAr,
          descriptionEn: i.descriptionEn,
          basePricePiasters: i.basePricePiasters,
          imageUrl: i.imageUrl,
          isSpicy: i.isSpicy,
          isVegetarian: i.isVegetarian,
          isBestSeller: i.isBestSeller,
          isFeatured: i.isFeatured,
          isSoldOut: i.isSoldOut,
          isActive: i.isActive,
          sizes: sizes
            .filter((z) => z.menuItemId === i.id)
            .map((z) => ({ id: z.id, nameAr: z.nameAr, nameEn: z.nameEn, pricePiasters: z.pricePiasters, isDefault: z.isDefault })),
          addonGroups: links
            .filter((l) => l.menuItemId === i.id)
            .map((l) => groupMap.get(l.addonGroupId))
            .filter((g): g is NonNullable<typeof g> => Boolean(g)),
        })),
    }));
}

export const getMenu = cached(() => loadMenu(false), ["menu"], { tags: [CACHE_TAGS.menu], revalidate: 300 });

/** Uncached, includes hidden items — for the admin and for pricing orders. */
export const getMenuFresh = (includeInactive = true) => loadMenu(includeInactive);

export function flattenMenu(menu: MenuCategory[]): MenuItem[] {
  return menu.flatMap((c) => c.items);
}

/** Lowest orderable price ("from" price for items with sizes). */
export function displayPrice(item: Pick<MenuItem, "sizes" | "basePricePiasters">): number {
  return item.sizes.length ? Math.min(...item.sizes.map((s) => s.pricePiasters)) : item.basePricePiasters;
}

// ── Zones, offers, reviews ──────────────────────────────────────────────────
export const getZones = cached(
  async (): Promise<Zone[]> => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(s.deliveryZones)
      .where(eq(s.deliveryZones.isActive, true))
      .orderBy(asc(s.deliveryZones.sortOrder));
    return rows.map((z) => ({
      id: z.id,
      slug: z.slug,
      nameAr: z.nameAr,
      nameEn: z.nameEn,
      feePiasters: z.feePiasters,
      minOrderPiasters: z.minOrderPiasters,
      etaMinMinutes: z.etaMinMinutes,
      etaMaxMinutes: z.etaMaxMinutes,
    }));
  },
  ["zones"],
  { tags: [CACHE_TAGS.zones], revalidate: 300 },
);

export const getOffers = cached(
  async (): Promise<Offer[]> => {
    const db = await getDb();
    const now = new Date();
    const rows = await db
      .select({ o: s.offers, slug: s.menuItems.slug, code: s.promoCodes.code })
      .from(s.offers)
      .leftJoin(s.menuItems, eq(s.menuItems.id, s.offers.menuItemId))
      .leftJoin(s.promoCodes, eq(s.promoCodes.id, s.offers.promoCodeId))
      .where(eq(s.offers.isActive, true))
      .orderBy(asc(s.offers.sortOrder));
    return rows
      .filter(({ o }) => (!o.startsAt || o.startsAt <= now) && (!o.endsAt || o.endsAt > now))
      .map(({ o, slug, code }) => ({
        id: o.id,
        titleAr: o.titleAr,
        titleEn: o.titleEn,
        subtitleAr: o.subtitleAr,
        subtitleEn: o.subtitleEn,
        badgeAr: o.badgeAr,
        badgeEn: o.badgeEn,
        imageUrl: o.imageUrl,
        menuItemSlug: slug,
        promoCode: code,
      }));
  },
  ["offers"],
  { tags: [CACHE_TAGS.offers], revalidate: 300 },
);

export const getReviews = cached(
  async (): Promise<{ reviews: Review[]; average: number; count: number }> => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(s.reviews)
      .where(and(eq(s.reviews.isPublished, true)))
      .orderBy(desc(s.reviews.createdAt))
      .limit(12);
    const count = rows.length;
    const average = count ? rows.reduce((a, r) => a + r.rating, 0) / count : 0;
    return {
      count,
      average,
      reviews: rows.map((r) => ({
        id: r.id,
        customerName: r.customerName,
        rating: r.rating,
        comment: r.comment,
        locale: r.locale,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },
  ["reviews"],
  { tags: [CACHE_TAGS.reviews], revalidate: 600 },
);

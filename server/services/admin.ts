import "server-only";
import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { fromCairoWallClock, toCairoWallClock } from "@/lib/hours";
import type { OrderStatus } from "@/lib/order-status";
import { getDb } from "../db";
import * as s from "../db/schema";
import type { Session } from "../auth/session";

export interface BoardOrder {
  id: string;
  orderNumber: number;
  trackingToken: string;
  status: OrderStatus;
  fulfillmentType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  zoneAr: string | null;
  zoneEn: string | null;
  address: string | null;
  landmark: string | null;
  notes: string | null;
  scheduledFor: string | null;
  placedAt: string;
  totalPiasters: number;
  paymentMethod: s.PaymentMethod;
  paymentStatus: s.PaymentStatus;
  assignedDriverId: string | null;
  items: { qty: number; nameAr: string; nameEn: string; sizeAr: string | null; sizeEn: string | null; addonsAr: string[]; addonsEn: string[]; notes: string | null }[];
}

export interface BoardData {
  orders: BoardOrder[];
  drivers: { id: string; name: string }[];
  today: { salesPiasters: number; orders: number };
  serverTime: string;
}

export function cairoDayStart(now = new Date()): Date {
  const w = toCairoWallClock(now);
  return fromCairoWallClock(w.year, w.month, w.day, 0, 0);
}

export async function getBoard(session: Session): Promise<BoardData> {
  const db = await getDb();
  const isDriverOnly = session.roles.every((r) => r === "driver");
  const active: OrderStatus[] = ["received", "preparing", "ready_for_pickup", "out_for_delivery"];
  const recent = new Date(Date.now() - 6 * 3600_000);

  const where = isDriverOnly
    ? and(eq(s.orders.assignedDriverId, session.userId), eq(s.orders.status, "out_for_delivery"))
    : or(
        inArray(s.orders.status, active),
        and(eq(s.orders.status, "pending_payment"), gte(s.orders.placedAt, recent)),
      );

  const rows = await db
    .select({ o: s.orders, z: s.deliveryZones })
    .from(s.orders)
    .leftJoin(s.deliveryZones, eq(s.deliveryZones.id, s.orders.zoneId))
    .where(where)
    .orderBy(asc(s.orders.placedAt))
    .limit(200);
  const ids = rows.map((r) => r.o.id);
  const items = ids.length ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, ids)) : [];
  const addons = items.length
    ? await db.select().from(s.orderItemAddons).where(inArray(s.orderItemAddons.orderItemId, items.map((i) => i.id)))
    : [];

  const drivers = await db
    .select({ id: s.profiles.id, name: s.profiles.fullName, email: s.profiles.email })
    .from(s.userRoles)
    .innerJoin(s.profiles, eq(s.profiles.id, s.userRoles.userId))
    .where(eq(s.userRoles.roleKey, "driver"));

  const dayStart = cairoDayStart();
  const [today] = await db
    .select({
      sales: sql<number>`coalesce(sum(${s.orders.totalPiasters}), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(s.orders)
    .where(and(gte(s.orders.placedAt, dayStart), sql`${s.orders.status} not in ('cancelled','pending_payment')`));

  return {
    serverTime: new Date().toISOString(),
    today: { salesPiasters: Number(today?.sales ?? 0), orders: Number(today?.n ?? 0) },
    drivers: drivers.map((d) => ({ id: d.id, name: d.name ?? d.email ?? "—" })),
    orders: rows.map(({ o, z }) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? 0,
      trackingToken: o.trackingToken,
      status: o.status,
      fulfillmentType: o.fulfillmentType,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      zoneAr: z?.nameAr ?? null,
      zoneEn: z?.nameEn ?? null,
      address: o.addressStreet ? [o.addressStreet, o.addressBuilding, o.addressFloor && `F${o.addressFloor}`, o.addressApartment && `#${o.addressApartment}`].filter(Boolean).join(" · ") : null,
      landmark: o.addressLandmark,
      notes: o.notes,
      scheduledFor: o.scheduledFor?.toISOString() ?? null,
      placedAt: o.placedAt.toISOString(),
      totalPiasters: o.totalPiasters,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      assignedDriverId: o.assignedDriverId,
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => {
          const ad = addons.filter((a) => a.orderItemId === i.id);
          return {
            qty: i.quantity,
            nameAr: i.nameAr,
            nameEn: i.nameEn,
            sizeAr: i.sizeNameAr,
            sizeEn: i.sizeNameEn,
            addonsAr: ad.map((a) => a.nameAr),
            addonsEn: ad.map((a) => a.nameEn),
            notes: i.notes,
          };
        }),
    })),
  };
}

export async function pendingInstapay() {
  const db = await getDb();
  return db
    .select({ p: s.payments, o: s.orders })
    .from(s.payments)
    .innerJoin(s.orders, eq(s.orders.id, s.payments.orderId))
    .where(and(eq(s.payments.provider, "instapay"), eq(s.payments.status, "pending_review")))
    .orderBy(asc(s.payments.updatedAt));
}

export async function listStaff() {
  const db = await getDb();
  const rows = await db
    .select({ id: s.profiles.id, name: s.profiles.fullName, email: s.profiles.email, phone: s.profiles.phone, role: s.userRoles.roleKey })
    .from(s.userRoles)
    .innerJoin(s.profiles, eq(s.profiles.id, s.userRoles.userId))
    .orderBy(asc(s.profiles.email));
  const map = new Map<string, { id: string; name: string | null; email: string | null; phone: string | null; roles: s.StaffRole[] }>();
  for (const r of rows) {
    const e = map.get(r.id) ?? { id: r.id, name: r.name, email: r.email, phone: r.phone, roles: [] };
    e.roles.push(r.role);
    map.set(r.id, e);
  }
  return [...map.values()];
}


import "server-only";
import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import * as s from "../db/schema";
import type { PromoRule } from "@/lib/pricing";

export type PromoError =
  | "NOT_FOUND"
  | "INACTIVE"
  | "EXPIRED"
  | "NOT_STARTED"
  | "USAGE_LIMIT"
  | "PHONE_LIMIT"
  | "MIN_SUBTOTAL"
  | "INVALID"
  | "RATE_LIMITED";

export type PromoCheck = { ok: true; rule: PromoRule } | { ok: false; error: PromoError; min?: number };

export const normalizePromo = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Validates a code. Pass phone/subtotal at checkout for the full check. */
export async function checkPromo(rawCode: string, opts: { phone?: string; subtotal?: number } = {}): Promise<PromoCheck> {
  const code = normalizePromo(rawCode);
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { ok: false, error: "INVALID" };
  const db = await getDb();
  const [p] = await db.select().from(s.promoCodes).where(eq(s.promoCodes.code, code)).limit(1);
  if (!p) return { ok: false, error: "NOT_FOUND" };
  if (!p.isActive) return { ok: false, error: "INACTIVE" };
  const now = new Date();
  if (p.startsAt && p.startsAt > now) return { ok: false, error: "NOT_STARTED" };
  if (p.endsAt && p.endsAt <= now) return { ok: false, error: "EXPIRED" };
  if (p.usageLimit !== null && p.timesUsed >= p.usageLimit) return { ok: false, error: "USAGE_LIMIT" };
  if (opts.subtotal !== undefined && opts.subtotal < p.minSubtotalPiasters) {
    return { ok: false, error: "MIN_SUBTOTAL", min: p.minSubtotalPiasters };
  }
  if (opts.phone && p.perPhoneLimit !== null) {
    const [used] = await db
      .select({ n: count() })
      .from(s.orders)
      .where(and(eq(s.orders.promoCodeId, p.id), eq(s.orders.customerPhone, opts.phone), ne(s.orders.status, "cancelled")));
    if ((used?.n ?? 0) >= p.perPhoneLimit) return { ok: false, error: "PHONE_LIMIT" };
  }
  return {
    ok: true,
    rule: {
      id: p.id,
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountValue,
      maxDiscountPiasters: p.maxDiscountPiasters,
      minSubtotalPiasters: p.minSubtotalPiasters,
    },
  };
}


"use server";

import { z } from "zod";
import { clientIp, rateLimit } from "../security/rate-limit";
import { checkPromo, type PromoCheck } from "../services/promos";

const input = z.object({ code: z.string().min(1).max(40), subtotal: z.number().int().min(0).max(100_000_000).optional() });

export async function validatePromoAction(raw: unknown): Promise<PromoCheck> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID" };
  const limit = await rateLimit(`promo:${await clientIp()}`, 10, 60);
  if (!limit.ok) return { ok: false, error: "RATE_LIMITED" };
  return checkPromo(parsed.data.code, { subtotal: parsed.data.subtotal });
}

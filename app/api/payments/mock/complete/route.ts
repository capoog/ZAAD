import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { mockTransaction } from "@/server/payments/paymob";
import { handlePaymobTransaction } from "@/server/services/payments";

export const dynamic = "force-dynamic";

/**
 * Mock Paymob gateway (PAYMENT_MODE=mock only). Produces a signed transaction
 * and feeds it through the same HMAC-verified handler as the real webhook.
 */
export async function POST(req: NextRequest) {
  if (env().PAYMENT_MODE !== "mock") return NextResponse.json({ error: "disabled" }, { status: 404 });
  const parsed = z.object({ paymentId: z.string().uuid(), outcome: z.enum(["success", "failure"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = await getDb();
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, parsed.data.paymentId)).limit(1);
  if (!p || p.provider !== "paymob") return NextResponse.json({ error: "not found" }, { status: 404 });
  const { obj, hmac } = mockTransaction(p.id, p.amountPiasters, parsed.data.outcome === "success", p.method);
  const res = await handlePaymobTransaction(obj, hmac);
  return NextResponse.json({ ok: res.ok, token: res.token, success: res.success });
}

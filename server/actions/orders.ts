"use server";

import { z } from "zod";
import { getSession } from "../auth/session";
import { clientIp, rateLimit } from "../security/rate-limit";
import { placeOrder, type PlaceOrderError } from "../services/orders";
import { startOnlinePayment, switchToCash } from "../services/payments";

export type CheckoutActionResult =
  | { ok: true; trackingToken: string; orderNumber: number; redirectUrl: string | null }
  | { ok: false; error: PlaceOrderError | { code: "PAYMENT_PROVIDER"; trackingToken: string } };

export async function placeOrderAction(raw: unknown): Promise<CheckoutActionResult> {
  const ip = await clientIp();
  if (!(await rateLimit(`order:ip:${ip}`, 20, 600)).ok) return { ok: false, error: { code: "RATE_LIMITED" } };
  const phone = (raw as { customer?: { phone?: unknown } } | null)?.customer?.phone;
  if (typeof phone === "string" && !(await rateLimit(`order:phone:${phone.replace(/\D/g, "")}`, 4, 600)).ok) {
    return { ok: false, error: { code: "RATE_LIMITED" } };
  }
  const session = await getSession();
  const res = await placeOrder(raw, { userId: session?.userId ?? null });
  if (!res.ok) return res;
  let redirectUrl: string | null = null;
  if (res.next === "pay") {
    const locale = (raw as { locale?: string })?.locale === "en" ? "en" : "ar";
    const pay = await startOnlinePayment(res.paymentId, locale);
    if ("error" in pay) return { ok: false, error: { code: "PAYMENT_PROVIDER", trackingToken: res.trackingToken } };
    redirectUrl = pay.redirectUrl;
  }
  return { ok: true, trackingToken: res.trackingToken, orderNumber: res.orderNumber, redirectUrl };
}

const tokenSchema = z.string().regex(/^[a-f0-9]{32}$/);

export async function retryPaymentAction(raw: unknown): Promise<{ redirectUrl: string } | { error: string }> {
  const parsed = z.object({ paymentId: z.string().uuid(), locale: z.enum(["ar", "en"]) }).safeParse(raw);
  if (!parsed.success) return { error: "INVALID" };
  if (!(await rateLimit(`pay-retry:${await clientIp()}`, 10, 600)).ok) return { error: "RATE_LIMITED" };
  const res = await startOnlinePayment(parsed.data.paymentId, parsed.data.locale);
  return "error" in res ? { error: res.error } : res;
}

export async function switchToCashAction(raw: unknown): Promise<boolean> {
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) return false;
  return switchToCash(parsed.data);
}

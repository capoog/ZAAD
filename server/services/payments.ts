import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, withActor } from "../db";
import * as s from "../db/schema";
import { env } from "../env";
import { createCheckout, verifyTransactionHmac, type PaymobTransaction } from "../payments/paymob";
import { publish } from "../realtime";
import { sniffImage, storage } from "../storage";
import { afterOrderReceived } from "./orders";

/** Begin an online payment for an order that is pending payment. */
export async function startOnlinePayment(paymentId: string, locale: "ar" | "en"): Promise<{ redirectUrl: string } | { error: "NOT_FOUND" | "NOT_PAYABLE" | "PROVIDER" }> {
  const db = await getDb();
  const [row] = await db
    .select({ p: s.payments, o: s.orders })
    .from(s.payments)
    .innerJoin(s.orders, eq(s.orders.id, s.payments.orderId))
    .where(eq(s.payments.id, paymentId))
    .limit(1);
  if (!row) return { error: "NOT_FOUND" };
  const { p, o } = row;
  if (p.provider !== "paymob" || p.status === "paid" || o.status !== "pending_payment") return { error: "NOT_PAYABLE" };
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
  const site = env().SITE_URL;
  try {
    const { redirectUrl, providerOrderId } = await createCheckout({
      paymentId: p.id,
      amountPiasters: p.amountPiasters,
      method: p.method as "card" | "wallet" | "fawry" | "valu",
      customer: { name: o.customerName, phone: o.customerPhone },
      // Paymob requires item amounts to sum to the total, so send one line.
      items: [{ name: `Order #${o.orderNumber} (${items.length} items)`, amountPiasters: p.amountPiasters, quantity: 1 }],
      returnUrl: `${site}/api/payments/paymob/return?locale=${locale}`,
      webhookUrl: `${site}/api/payments/paymob/webhook`,
    });
    await db.update(s.payments).set({ providerOrderId }).where(eq(s.payments.id, p.id));
    return { redirectUrl: redirectUrl.startsWith("/") ? `${locale === "en" ? "/en" : ""}${redirectUrl}` : redirectUrl };
  } catch (err) {
    console.error("[payments] checkout failed", err);
    return { error: "PROVIDER" };
  }
}

/**
 * The single place where an online payment becomes "paid": a Paymob
 * transaction whose HMAC verifies. Idempotent (webhooks can repeat).
 */
export async function handlePaymobTransaction(obj: PaymobTransaction, hmac: string): Promise<{ ok: boolean; token?: string; success?: boolean }> {
  if (!verifyTransactionHmac(obj, hmac)) return { ok: false };
  const paymentId = obj.special_reference || obj.order?.merchant_order_id;
  if (!paymentId || !/^[0-9a-f-]{36}$/.test(paymentId)) return { ok: false };
  const db = await getDb();
  const [row] = await db
    .select({ p: s.payments, o: s.orders })
    .from(s.payments)
    .innerJoin(s.orders, eq(s.orders.id, s.payments.orderId))
    .where(eq(s.payments.id, paymentId))
    .limit(1);
  if (!row) return { ok: false };
  const { p, o } = row;
  if (p.status === "paid") return { ok: true, token: o.trackingToken, success: true };
  // The amount must match what we asked for.
  const success = obj.success === true && !obj.pending && Number(obj.amount_cents) === p.amountPiasters;

  await withActor(null, async (tx) => {
    await tx
      .update(s.payments)
      .set({ status: success ? "paid" : "failed", providerRef: String(obj.id), raw: obj as unknown as Record<string, unknown> })
      .where(eq(s.payments.id, p.id));
    await tx
      .update(s.orders)
      .set(success ? { paymentStatus: "paid", status: o.status === "pending_payment" ? "received" : o.status } : { paymentStatus: "failed" })
      .where(eq(s.orders.id, o.id));
  });
  await publish(`order:${o.trackingToken}`, { type: "payment.updated", orderId: o.id, status: success ? "received" : o.status });
  if (success && o.status === "pending_payment") await afterOrderReceived(o.id);
  return { ok: true, token: o.trackingToken, success };
}

/** Customer switches a failed/abandoned online payment to cash on delivery. */
export async function switchToCash(token: string): Promise<boolean> {
  const db = await getDb();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.trackingToken, token)).limit(1);
  if (!o || o.status !== "pending_payment" || o.paymentStatus === "paid" || o.paymentMethod === "instapay") return false;
  await withActor(null, async (tx) => {
    await tx.update(s.payments).set({ status: "cancelled" }).where(and(eq(s.payments.orderId, o.id), eq(s.payments.provider, "paymob")));
    await tx.insert(s.payments).values({ orderId: o.id, provider: "cod", method: "cash", status: "pending", amountPiasters: o.totalPiasters });
    await tx.update(s.orders).set({ paymentMethod: "cash", paymentStatus: "unpaid", status: "received" }).where(eq(s.orders.id, o.id));
  });
  await afterOrderReceived(o.id);
  return true;
}

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** InstaPay: customer uploads the transfer screenshot; a manager confirms later. */
export async function submitInstapayProof(token: string, file: File, payerReference: string | null): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_PENDING" | "TOO_LARGE" | "BAD_TYPE" }> {
  if (file.size > MAX_PROOF_BYTES) return { ok: false, error: "TOO_LARGE" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: "BAD_TYPE" };
  const db = await getDb();
  const [row] = await db
    .select({ p: s.payments, o: s.orders })
    .from(s.payments)
    .innerJoin(s.orders, eq(s.orders.id, s.payments.orderId))
    .where(and(eq(s.orders.trackingToken, token), eq(s.payments.provider, "instapay")))
    .limit(1);
  if (!row) return { ok: false, error: "NOT_FOUND" };
  if (row.p.status === "paid" || row.o.status !== "pending_payment") return { ok: false, error: "NOT_PENDING" };
  const key = `${row.o.id}/${Date.now()}.${kind.ext}`;
  await storage().put("payment-proofs", key, bytes, kind.type);
  await db
    .update(s.payments)
    .set({ status: "pending_review", proofPath: key, payerReference: payerReference?.slice(0, 60) ?? null, reviewNote: null })
    .where(eq(s.payments.id, row.p.id));
  await db.update(s.orders).set({ paymentStatus: "pending_review" }).where(eq(s.orders.id, row.o.id));
  await publish("staff:orders", { type: "payment.updated", orderId: row.o.id, status: "pending_review" });
  await publish(`order:${token}`, { type: "payment.updated", orderId: row.o.id, status: "pending_payment" });
  return { ok: true };
}

/** Manager decision on an InstaPay transfer. */
export async function reviewInstapay(paymentId: string, approve: boolean, reviewerId: string, note: string | null): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ p: s.payments, o: s.orders })
    .from(s.payments)
    .innerJoin(s.orders, eq(s.orders.id, s.payments.orderId))
    .where(eq(s.payments.id, paymentId))
    .limit(1);
  if (!row || row.p.provider !== "instapay" || row.p.status !== "pending_review") return false;
  await withActor(reviewerId, async (tx) => {
    await tx
      .update(s.payments)
      .set({ status: approve ? "paid" : "failed", reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote: note })
      .where(eq(s.payments.id, paymentId));
    await tx
      .update(s.orders)
      .set(approve ? { paymentStatus: "paid", status: "received" } : { paymentStatus: "failed" })
      .where(eq(s.orders.id, row.o.id));
  });
  await publish(`order:${row.o.trackingToken}`, { type: "payment.updated", orderId: row.o.id, status: approve ? "received" : "pending_payment" });
  await publish("staff:orders", { type: "payment.updated", orderId: row.o.id });
  if (approve) await afterOrderReceived(row.o.id);
  return true;
}

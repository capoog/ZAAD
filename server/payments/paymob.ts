import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import type { PaymentMethod } from "../db/schema";

/**
 * Paymob behind an abstraction:
 *   mock     → simulated hosted checkout (/pay/mock/…) that produces a signed
 *              Paymob-shaped transaction, verified exactly like a real webhook
 *   sandbox  → Paymob test credentials (Intention API + Unified Checkout)
 *   live     → production credentials
 * Orders are only ever marked paid after HMAC verification on the server.
 */
export interface CheckoutRequest {
  paymentId: string;
  amountPiasters: number;
  method: Extract<PaymentMethod, "card" | "wallet" | "fawry" | "valu">;
  customer: { name: string; phone: string };
  items: { name: string; amountPiasters: number; quantity: number }[];
  returnUrl: string;
  webhookUrl: string;
}

export interface PaymobTransaction {
  id: number | string;
  amount_cents: number;
  created_at: string;
  currency: string;
  error_occured: boolean;
  has_parent_transaction: boolean;
  integration_id: number | string;
  is_3d_secure: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_refunded: boolean;
  is_standalone_payment: boolean;
  is_voided: boolean;
  order: { id: number | string; merchant_order_id?: string | null };
  owner: number | string;
  pending: boolean;
  source_data: { pan: string; sub_type: string; type: string };
  success: boolean;
  special_reference?: string | null;
}

export const MOCK_HMAC_SECRET = "fz-mock-paymob-hmac";

export function hmacSecret(): string {
  return env().PAYMENT_MODE === "mock" ? MOCK_HMAC_SECRET : (env().PAYMOB_HMAC_SECRET ?? "");
}

/** Paymob's documented field order for the "transaction processed" HMAC. */
export function transactionHmac(t: PaymobTransaction, secret = hmacSecret()): string {
  const fields = [
    t.amount_cents,
    t.created_at,
    t.currency,
    t.error_occured,
    t.has_parent_transaction,
    t.id,
    t.integration_id,
    t.is_3d_secure,
    t.is_auth,
    t.is_capture,
    t.is_refunded,
    t.is_standalone_payment,
    t.is_voided,
    t.order.id,
    t.owner,
    t.pending,
    t.source_data.pan,
    t.source_data.sub_type,
    t.source_data.type,
    t.success,
  ];
  return createHmac("sha512", secret).update(fields.map((f) => String(f)).join("")).digest("hex");
}

export function verifyTransactionHmac(t: PaymobTransaction, hmac: string): boolean {
  const secret = hmacSecret();
  if (!secret || !/^[a-f0-9]{128}$/i.test(hmac)) return false;
  const a = Buffer.from(transactionHmac(t, secret), "hex");
  const b = Buffer.from(hmac.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function integrationId(method: CheckoutRequest["method"]): number {
  const e = env();
  const raw = { card: e.PAYMOB_INTEGRATION_CARD, wallet: e.PAYMOB_INTEGRATION_WALLET, fawry: e.PAYMOB_INTEGRATION_FAWRY, valu: e.PAYMOB_INTEGRATION_VALU }[method];
  const id = Number(raw);
  if (!id) throw new Error(`Paymob integration id for ${method} is not configured`);
  return id;
}

/** Returns where to send the customer to pay. */
export async function createCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string; providerOrderId: string | null }> {
  const e = env();
  if (e.PAYMENT_MODE === "mock") {
    return { redirectUrl: `/pay/mock/${req.paymentId}`, providerOrderId: `MOCK-${req.paymentId.slice(0, 8)}` };
  }
  const [first, ...rest] = req.customer.name.trim().split(/\s+/);
  const res = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST",
    headers: { Authorization: `Token ${e.PAYMOB_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: req.amountPiasters,
      currency: "EGP",
      payment_methods: [integrationId(req.method)],
      items: req.items.map((i) => ({ name: i.name.slice(0, 50), amount: i.amountPiasters, quantity: i.quantity })),
      billing_data: {
        first_name: first || "Customer",
        last_name: rest.join(" ") || "-",
        phone_number: `+2${req.customer.phone}`,
        email: "na@fahmzaatar.app",
        country: "EG",
        city: "Cairo",
        street: "NA",
        building: "NA",
        floor: "NA",
        apartment: "NA",
      },
      special_reference: req.paymentId,
      notification_url: req.webhookUrl,
      redirection_url: req.returnUrl,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Paymob intention failed: ${res.status}`);
  const data = (await res.json()) as { client_secret: string; id: string };
  return {
    redirectUrl: `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(e.PAYMOB_PUBLIC_KEY ?? "")}&clientSecret=${encodeURIComponent(data.client_secret)}`,
    providerOrderId: data.id,
  };
}

/** Build a signed, Paymob-shaped transaction for the mock checkout. */
export function mockTransaction(paymentId: string, amountPiasters: number, success: boolean, method: string): { obj: PaymobTransaction; hmac: string } {
  const obj: PaymobTransaction = {
    id: Math.floor(100_000_000 + Math.random() * 899_999_999),
    amount_cents: amountPiasters,
    created_at: new Date().toISOString(),
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    integration_id: 0,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: Math.floor(10_000_000 + Math.random() * 89_999_999), merchant_order_id: paymentId },
    owner: 0,
    pending: false,
    source_data: { pan: method === "card" ? "2346" : "01010101010", sub_type: method === "card" ? "MasterCard" : method, type: method === "card" ? "card" : "wallet" },
    success,
    special_reference: paymentId,
  };
  return { obj, hmac: transactionHmac(obj, MOCK_HMAC_SECRET) };
}

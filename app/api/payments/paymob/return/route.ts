import { NextResponse, type NextRequest } from "next/server";
import { handlePaymobTransaction } from "@/server/services/payments";
import type { PaymobTransaction } from "@/server/payments/paymob";

export const dynamic = "force-dynamic";

const bool = (v: string | null) => v === "true";

/** Customer is redirected back here by Paymob (query carries a signed copy of the transaction). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const locale = q.get("locale") === "en" ? "/en" : "";
  const obj: PaymobTransaction = {
    id: q.get("id") ?? "",
    amount_cents: Number(q.get("amount_cents")),
    created_at: q.get("created_at") ?? "",
    currency: q.get("currency") ?? "",
    error_occured: bool(q.get("error_occured")),
    has_parent_transaction: bool(q.get("has_parent_transaction")),
    integration_id: q.get("integration_id") ?? "",
    is_3d_secure: bool(q.get("is_3d_secure")),
    is_auth: bool(q.get("is_auth")),
    is_capture: bool(q.get("is_capture")),
    is_refunded: bool(q.get("is_refunded")),
    is_standalone_payment: bool(q.get("is_standalone_payment")),
    is_voided: bool(q.get("is_voided")),
    order: { id: q.get("order") ?? "", merchant_order_id: q.get("merchant_order_id") },
    owner: q.get("owner") ?? "",
    pending: bool(q.get("pending")),
    source_data: { pan: q.get("source_data.pan") ?? "", sub_type: q.get("source_data.sub_type") ?? "", type: q.get("source_data.type") ?? "" },
    success: bool(q.get("success")),
    special_reference: q.get("special_reference") ?? q.get("merchant_order_id"),
  };
  const res = await handlePaymobTransaction(obj, q.get("hmac") ?? "");
  const target = res.token ? `${locale}/orders/${res.token}?payment=${res.success ? "success" : "failed"}` : `${locale}/`;
  return NextResponse.redirect(new URL(target, req.nextUrl.origin));
}

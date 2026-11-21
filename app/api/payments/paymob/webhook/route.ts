import { NextResponse, type NextRequest } from "next/server";
import { handlePaymobTransaction } from "@/server/services/payments";
import type { PaymobTransaction } from "@/server/payments/paymob";

export const dynamic = "force-dynamic";

/** Paymob "transaction processed" callback. The HMAC is the only trust anchor. */
export async function POST(req: NextRequest) {
  const hmac = req.nextUrl.searchParams.get("hmac") ?? "";
  let body: { type?: string; obj?: PaymobTransaction };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (body.type !== "TRANSACTION" || !body.obj) return NextResponse.json({ ok: true, ignored: true });
  const res = await handlePaymobTransaction(body.obj, hmac);
  return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 401 });
}

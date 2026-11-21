import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { submitInstapayProof } from "@/server/services/payments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!(await rateLimit(`instapay:${await clientIp()}`, 6, 600)).ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("proof");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "BAD_TYPE" }, { status: 400 });
  const ref = form?.get("payerReference");
  const res = await submitInstapayProof(token, file, typeof ref === "string" ? ref.replace(/[<>]/g, "").trim() || null : null);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

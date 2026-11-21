import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Lock, ShieldCheck } from "lucide-react";
import { Price } from "@/components/brand/price";
import { MockPayButtons } from "@/components/checkout/mock-pay-buttons";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paymob (test)", robots: { index: false, follow: false } };

export default async function MockPayPage({ params }: { params: Promise<{ locale: string; paymentId: string }> }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  if (env().PAYMENT_MODE !== "mock" || !/^[0-9a-f-]{36}$/.test(paymentId)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ p: s.payments, o: s.orders })
    .from(s.payments)
    .innerJoin(s.orders, eq(s.orders.id, s.payments.orderId))
    .where(eq(s.payments.id, paymentId))
    .limit(1);
  if (!row || row.p.provider !== "paymob") notFound();
  const t = await getTranslations("mockPay");
  const tp = await getTranslations("payment");
  const loc = locale === "en" ? "en" : "ar";

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-[#f4f6fb] px-4 py-10 text-[#111827]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-30px_rgb(0_0_0/0.35)]">
        <div className="flex items-center justify-between bg-[#0b2a4a] px-6 py-4 text-white">
          <span className="font-sans text-lg font-bold tracking-wide" dir="ltr">
            paymob <span className="rounded bg-white/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">test</span>
          </span>
          <Lock className="size-4 opacity-80" aria-hidden />
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div>
            <h1 className="font-sans text-xl font-bold text-[#111827]">{t("title")}</h1>
            <p className="mt-1 text-sm text-[#4b5563]">{t("subtitle")}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#f3f4f6] px-4 py-3">
            <span className="text-sm text-[#4b5563]">
              {t("amount")} · #{row.o.orderNumber} · {tp(row.p.method)}
            </span>
            <Price piasters={row.p.amountPiasters} locale={loc} className="text-lg text-[#111827]" />
          </div>
          <div className="grid gap-3" aria-hidden>
            <div className="rounded-lg border border-[#d1d5db] px-3 py-2.5 font-mono text-sm text-[#374151]" dir="ltr">
              5123 4567 8901 2346
            </div>
            <div className="grid grid-cols-2 gap-3" dir="ltr">
              <div className="rounded-lg border border-[#d1d5db] px-3 py-2.5 font-mono text-sm text-[#374151]">12 / 30</div>
              <div className="rounded-lg border border-[#d1d5db] px-3 py-2.5 font-mono text-sm text-[#374151]">•••</div>
            </div>
          </div>
          <MockPayButtons paymentId={paymentId} amountLabel={<Price piasters={row.p.amountPiasters} locale={loc} />} payLabel={t("pay", { amount: "" })} failLabel={t("fail")} processingLabel={t("processing")} />
          <p className="flex items-center justify-center gap-1.5 text-xs text-[#6b7280]">
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("secure")}
          </p>
        </div>
      </div>
    </main>
  );
}

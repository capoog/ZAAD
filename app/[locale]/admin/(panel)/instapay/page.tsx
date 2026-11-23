import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Price } from "@/components/brand/price";
import { EmptyState } from "@/components/common/empty-state";
import { InstapayReview } from "@/components/admin/instapay-review";
import { RESTAURANT_TZ } from "@/lib/hours";
import { formatPhone } from "@/lib/phone";
import { MANAGERS, requireStaffPage } from "@/server/auth/guard";
import { pendingInstapay } from "@/server/services/admin";
import { storage } from "@/server/storage";

export default async function InstapayQueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  await requireStaffPage(raw, MANAGERS);
  const locale = raw === "en" ? "en" : "ar";
  const t = await getTranslations("admin.instapay");
  const rows = await pendingInstapay();
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: RESTAURANT_TZ, timeStyle: "short", dateStyle: "short" });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      {rows.length === 0 ? (
        <EmptyState icon={<CheckCircle2 aria-hidden />} title={t("empty")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ p, o }) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl">#{o.orderNumber}</p>
                  <p className="text-sm">
                    {o.customerName} · <bdi dir="ltr">{formatPhone(o.customerPhone)}</bdi>
                  </p>
                  <p className="text-xs text-smoke-400">{t("uploaded", { time: fmt.format(p.updatedAt) })}</p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-smoke-400">{t("amount")}</p>
                  <Price piasters={p.amountPiasters} locale={locale} className="text-lg text-ember-300" />
                </div>
              </div>
              {p.proofPath && (
                <a href={storage().url("payment-proofs", p.proofPath)} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-border bg-coal-950">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file */}
                  <img src={storage().url("payment-proofs", p.proofPath)} alt={`InstaPay #${o.orderNumber}`} className="max-h-80 w-full object-contain" />
                </a>
              )}
              {p.payerReference && (
                <p className="text-sm">
                  <span className="text-smoke-400">{t("payer")}:</span> {p.payerReference}
                </p>
              )}
              <InstapayReview paymentId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

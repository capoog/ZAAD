import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AutoPrint } from "@/components/admin/auto-print";
import { RESTAURANT_TZ } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { requireStaffPage } from "@/server/auth/guard";
import { getOrderDetail } from "@/server/services/orders";

/** 80 mm thermal-printer friendly kitchen ticket (black on white, big item lines). */
export default async function TicketPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  setRequestLocale(raw);
  await requireStaffPage(raw, ["owner", "manager", "kitchen"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const o = await getOrderDetail({ id });
  if (!o) notFound();
  const locale = raw === "en" ? "en" : "ar";
  const t = await getTranslations("admin.ticket");
  const tp = await getTranslations("payment");
  const ts = await getTranslations("admin.board");
  const L = (ar: string | null, en: string | null) => (locale === "ar" ? ar : en) ?? "";
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: RESTAURANT_TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-neutral-200 py-6 print:static print:bg-white print:py-0">
      <article className="print-area mx-auto w-[80mm] bg-white p-4 font-sans text-[13px] leading-snug text-black shadow-xl print:shadow-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mono.svg" alt="Fahm & Zaatar" className="mx-auto h-10" />
        <div className="my-3 border-y-2 border-dashed border-black py-2 text-center">
          <p className="text-xs">{t("order")}</p>
          <p className="text-3xl font-black">#{o.orderNumber}</p>
          <p className="text-sm font-bold">{o.fulfillmentType === "delivery" ? ts("delivery") : ts("pickup")}{o.scheduledFor ? ` · ${fmt(o.scheduledFor)}` : ""}</p>
        </div>
        <p>
          <b>{t("placed")}:</b> {fmt(o.placedAt)}
        </p>
        <p>
          <b>{t("customer")}:</b> {o.customerName} · <bdi dir="ltr">{formatPhone(o.customerPhone)}</bdi>
        </p>
        {o.fulfillmentType === "delivery" && (
          <p>
            <b>{t("address")}:</b> {L(o.zone?.nameAr ?? "", o.zone?.nameEn ?? "")} — {o.address.street} {o.address.building}
            {o.address.floor ? ` / ${o.address.floor}` : ""}
            {o.address.apartment ? ` / ${o.address.apartment}` : ""}
            {o.address.landmark ? ` (${o.address.landmark})` : ""}
          </p>
        )}
        <ul className="my-3 border-y border-dashed border-black py-2">
          {o.items.map((it) => (
            <li key={it.id} className="py-1">
              <p className="text-base font-bold">
                {it.quantity} × {L(it.nameAr, it.nameEn)}
                {it.sizeNameAr ? ` (${L(it.sizeNameAr, it.sizeNameEn)})` : ""}
              </p>
              {it.addons.length > 0 && <p className="ps-4">+ {it.addons.map((a) => L(a.nameAr, a.nameEn)).join("، ")}</p>}
              {it.notes && <p className="ps-4 font-bold">!! {it.notes}</p>}
            </li>
          ))}
        </ul>
        {o.notes && (
          <p className="mb-2 border border-black p-1.5 font-bold">
            {t("notes")}: {o.notes}
          </p>
        )}
        <p className="flex justify-between text-base font-black">
          <span>{t("total")}</span>
          <span>{formatMoney(o.totalPiasters, locale)}</span>
        </p>
        <p className="flex justify-between">
          <span>{t("payment")}</span>
          <span>
            {tp(o.paymentMethod)} — {o.paymentStatus === "paid" ? ts("paid") : ts("cashDue", { amount: formatMoney(o.totalPiasters, locale) })}
          </span>
        </p>
      </article>
      <AutoPrint label={t("printAgain")} />
    </div>
  );
}

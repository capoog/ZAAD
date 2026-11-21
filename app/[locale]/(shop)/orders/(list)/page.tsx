import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight, MapPin, ReceiptText } from "lucide-react";
import { Price } from "@/components/brand/price";
import { EmptyState } from "@/components/common/empty-state";
import { AddressButtons, LogoutButton } from "@/components/account/account-actions";
import { PhoneLogin } from "@/components/account/phone-login";
import { RecentDeviceOrders } from "@/components/account/recent-device-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RESTAURANT_TZ } from "@/lib/hours";
import { formatPhone } from "@/lib/phone";
import { getSession } from "@/server/auth/session";
import { asUser } from "@/server/db";
import * as s from "@/server/db/schema";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title"), robots: { index: false } };
}

const STATUS_VARIANT = {
  pending_payment: "flame",
  received: "ember",
  preparing: "ember",
  ready_for_pickup: "zaatar",
  out_for_delivery: "zaatar",
  delivered: "default",
  cancelled: "chili",
} as const;

export default async function MyOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw === "en" ? "en" : "ar";
  const t = await getTranslations("account");
  const ts = await getTranslations("status");
  const session = await getSession();
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-16 lg:px-8">
        <h1 className="sr-only">{t("title")}</h1>
        <PhoneLogin />
        <RecentDeviceOrders />
      </div>
    );
  }

  // Both queries run as the customer under Row Level Security.
  const [orders, addresses] = await asUser(session.userId, async (tx) => [
    await tx.select().from(s.orders).orderBy(desc(s.orders.placedAt)).limit(30),
    await tx
      .select({ a: s.addresses, z: s.deliveryZones })
      .from(s.addresses)
      .leftJoin(s.deliveryZones, eq(s.deliveryZones.id, s.addresses.zoneId))
      .orderBy(desc(s.addresses.isDefault), desc(s.addresses.createdAt)),
  ] as const);
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: RESTAURANT_TZ, dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-6 md:pt-12 lg:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl md:text-5xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-smoke-300">
            {session.fullName ? `${session.fullName} · ` : ""}
            <bdi dir="ltr">{session.phone ? formatPhone(session.phone) : session.email}</bdi>
          </p>
        </div>
        <LogoutButton />
      </div>

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" className="mb-3 font-sans text-lg font-semibold">
          {t("orders")}
        </h2>
        {orders.length === 0 ? (
          <EmptyState
            icon={<ReceiptText aria-hidden />}
            title={t("noOrders")}
            description={t("noOrdersHint")}
            action={
              <Button asChild>
                <Link href="/menu">{(await getTranslations("menu"))("title")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.trackingToken}`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-border-strong">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-coal-700 font-display text-ember-300">#{String(o.orderNumber).slice(-3)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{o.orderNumber}</span>
                      <Badge variant={STATUS_VARIANT[o.status]}>{ts(o.status)}</Badge>
                    </span>
                    <span className="text-xs text-smoke-400">{fmt.format(o.placedAt)}</span>
                  </span>
                  <Price piasters={o.totalPiasters} locale={locale} />
                  <Chevron className="size-4 text-smoke-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="addr-h" className="mt-10">
        <h2 id="addr-h" className="mb-3 font-sans text-lg font-semibold">
          {t("addresses")}
        </h2>
        {addresses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-5 text-sm text-smoke-300">
            {t("noAddresses")} — {t("noAddressesHint")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {addresses.map(({ a, z }) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <MapPin className="size-5 text-ember-400" aria-hidden />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{locale === "ar" ? z?.nameAr : z?.nameEn}</span> · {a.street} {a.building}
                  {a.landmark && <span className="block text-xs text-smoke-400">{a.landmark}</span>}
                </span>
                {a.isDefault && <Badge variant="zaatar">{t("defaultAddress")}</Badge>}
                <AddressButtons id={a.id} isDefault={a.isDefault} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

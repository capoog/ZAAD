import { asc, desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GeneralSettings, HoursSettings, OfferSettings, PromoSettings, ZonesSettings } from "@/components/admin/settings-forms";
import { MANAGERS, requireStaffPage } from "@/server/auth/guard";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { getPublicSettings } from "@/server/services/catalog";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale, MANAGERS);
  const t = await getTranslations("admin.settings");
  const db = await getDb();
  const [settings, zones, promos, offers, notif] = await Promise.all([
    getPublicSettings(),
    db.select().from(s.deliveryZones).orderBy(asc(s.deliveryZones.sortOrder)),
    db.select().from(s.promoCodes).orderBy(desc(s.promoCodes.createdAt)),
    db.select().from(s.offers).orderBy(asc(s.offers.sortOrder)),
    db.select().from(s.settings).where(eq(s.settings.key, "notifications")).limit(1),
  ]);
  const alertPhone = (notif[0]?.value as { restaurantAlertPhone?: string } | undefined)?.restaurantAlertPhone ?? "";
  const nav = [
    ["ordering", t("ordering")],
    ["hours", t("hours")],
    ["zones", t("zones")],
    ["promos", t("promos")],
    ["offers", t("offers")],
  ];
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" aria-label={t("title")}>
        {nav.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="h-9 shrink-0 rounded-full border border-border-strong bg-coal-850 px-4 text-sm leading-9 hover:border-ember-400/60">
            {label}
          </a>
        ))}
      </nav>
      <GeneralSettings ordering={settings.ordering} vat={settings.vat} payments={settings.payments} instapay={settings.instapay} alertPhone={alertPhone} />
      <HoursSettings hours={settings.hours} />
      <ZonesSettings
        zones={zones.map((z) => ({
          id: z.id,
          slug: z.slug,
          nameAr: z.nameAr,
          nameEn: z.nameEn,
          fee: String(z.feePiasters / 100),
          minOrder: String(z.minOrderPiasters / 100),
          etaMin: String(z.etaMinMinutes),
          etaMax: String(z.etaMaxMinutes),
          isActive: z.isActive,
        }))}
      />
      <PromoSettings
        promos={promos.map((p) => ({
          id: p.id,
          code: p.code,
          discountType: p.discountType,
          discountValue: p.discountValue,
          maxDiscountPiasters: p.maxDiscountPiasters,
          minSubtotalPiasters: p.minSubtotalPiasters,
          perPhoneLimit: p.perPhoneLimit,
          timesUsed: p.timesUsed,
          usageLimit: p.usageLimit,
          endsAt: p.endsAt?.toISOString() ?? null,
          isActive: p.isActive,
        }))}
      />
      <OfferSettings offers={offers.map((o) => ({ id: o.id, title: locale === "ar" ? o.titleAr : o.titleEn, isActive: o.isActive }))} />
    </div>
  );
}

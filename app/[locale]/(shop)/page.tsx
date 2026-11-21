import { setRequestLocale } from "next-intl/server";
import { CategoryRail } from "@/components/home/category-rail";
import { Featured } from "@/components/home/featured";
import { Hero } from "@/components/home/hero";
import { Location } from "@/components/home/location";
import { Offers } from "@/components/home/offers";
import { Reviews } from "@/components/home/reviews";
import { Why } from "@/components/home/why";
import { getMenu, getOffers, getPublicSettings, getReviews, getZones } from "@/server/services/catalog";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw === "en" ? "en" : "ar";
  const [menu, zones, settings, offers, reviews] = await Promise.all([
    getMenu(),
    getZones(),
    getPublicSettings(),
    getOffers(),
    getReviews(),
  ]);
  const featured = menu.flatMap((c) => c.items).filter((i) => i.isFeatured && !i.isSoldOut).slice(0, 6);

  return (
    <>
      <Hero settings={settings} zones={zones} locale={locale} />
      <CategoryRail menu={menu} locale={locale} />
      <Featured items={featured} locale={locale} />
      <Offers offers={offers} locale={locale} />
      <Why />
      <Reviews data={reviews} />
      <Location settings={settings} zones={zones} locale={locale} />
    </>
  );
}

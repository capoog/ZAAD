import type { MenuCategory, PublicSettings } from "@/types/catalog";
import { SITE_URL } from "./site";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const egp = (piasters: number) => (piasters / 100).toFixed(2);

export function restaurantJsonLd(settings: PublicSettings, locale: "ar" | "en", rating?: { average: number; count: number }) {
  const r = settings.restaurant;
  const base = `${SITE_URL}${locale === "en" ? "/en" : ""}`;
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: locale === "ar" ? r.nameAr : r.nameEn,
    alternateName: locale === "ar" ? r.nameEn : r.nameAr,
    url: base || SITE_URL,
    image: `${SITE_URL}/og.jpg`,
    logo: `${SITE_URL}/brand/app-icon-512.png`,
    telephone: `+2${r.phone}`,
    servesCuisine: ["Egyptian", "Levantine", "Grill", "Shawarma"],
    priceRange: "EGP 15–650",
    currenciesAccepted: "EGP",
    paymentAccepted: "Cash, Credit Card, Mobile Wallet, Fawry, valU, InstaPay",
    address: {
      "@type": "PostalAddress",
      streetAddress: locale === "ar" ? r.addressAr : r.addressEn,
      addressLocality: "New Cairo",
      addressRegion: "Cairo Governorate",
      addressCountry: "EG",
    },
    geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng },
    hasMenu: `${base}/menu`,
    acceptsReservations: false,
    openingHoursSpecification: settings.hours
      .filter((h) => !h.isClosed)
      .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${DAYS[h.dayOfWeek]}`, opens: h.opensAt, closes: h.closesAt })),
    potentialAction: {
      "@type": "OrderAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/menu`, actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"] },
      deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet", "http://purl.org/goodrelations/v1#DeliveryModePickUp"],
    },
    ...(rating && rating.count
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average.toFixed(1), reviewCount: rating.count, bestRating: 5 } }
      : {}),
  };
}

export function menuJsonLd(menu: MenuCategory[], locale: "ar" | "en") {
  const base = `${SITE_URL}${locale === "en" ? "/en" : ""}`;
  const L = (ar: string | null, en: string | null) => (locale === "ar" ? ar : en) ?? undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${base}/menu#menu`,
    name: locale === "ar" ? "منيو فحم وزعتر" : "Fahm & Zaatar menu",
    inLanguage: locale,
    url: `${base}/menu`,
    hasMenuSection: menu.map((c) => ({
      "@type": "MenuSection",
      name: L(c.nameAr, c.nameEn),
      description: L(c.descriptionAr, c.descriptionEn),
      hasMenuItem: c.items.map((i) => ({
        "@type": "MenuItem",
        name: L(i.nameAr, i.nameEn),
        description: L(i.descriptionAr, i.descriptionEn),
        url: `${base}/menu/${i.slug}`,
        image: i.imageUrl?.startsWith("http") ? i.imageUrl : `${SITE_URL}${i.imageUrl ?? ""}`,
        suitableForDiet: i.isVegetarian ? "https://schema.org/VegetarianDiet" : undefined,
        offers: (i.sizes.length ? i.sizes : [{ nameAr: "", nameEn: "", pricePiasters: i.basePricePiasters }]).map((s) => ({
          "@type": "Offer",
          name: L(s.nameAr, s.nameEn) || undefined,
          price: egp(s.pricePiasters),
          priceCurrency: "EGP",
          availability: i.isSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        })),
      })),
    })),
  };
}

/** Safe for <script type="application/ld+json"> (no closing tags). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

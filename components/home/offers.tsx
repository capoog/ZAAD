import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FoodImage } from "@/components/brand/food-image";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Offer } from "@/types/catalog";
import { CopyCode } from "./copy-code";
import { SectionHeading } from "./section-heading";

export async function Offers({ offers, locale }: { offers: Offer[]; locale: "ar" | "en" }) {
  if (!offers.length) return null;
  const t = await getTranslations("home");
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const L = <T,>(ar: T, en: T) => (locale === "ar" ? ar : en);
  return (
    <section id="offers" aria-labelledby="offers-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-16 sm:px-6 lg:px-8">
      <SectionHeading id="offers-title" title={t("offersTitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {offers.map((o, i) => (
          <article
            key={o.id}
            className={`group relative isolate flex min-h-64 flex-col justify-end overflow-hidden rounded-2xl border border-border p-5 shadow-card ${i === 0 ? "md:col-span-2 md:min-h-80" : ""}`}
          >
            <FoodImage
              src={o.imageUrl}
              alt=""
              sizes={i === 0 ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
              className="absolute inset-0 -z-10"
              imgClassName="transition-transform duration-700 group-hover:scale-105"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-coal-950 via-coal-950/70 to-coal-950/10" />
            {L(o.badgeAr, o.badgeEn) && (
              <Badge variant="solid" className="absolute start-5 top-5">
                {L(o.badgeAr, o.badgeEn)}
              </Badge>
            )}
            <h3 className="text-2xl text-cream-50 md:text-3xl">{L(o.titleAr, o.titleEn)}</h3>
            {L(o.subtitleAr, o.subtitleEn) && <p className="mt-1 text-sm text-smoke-200">{L(o.subtitleAr, o.subtitleEn)}</p>}
            <div className="mt-4 flex items-center gap-3">
              {o.promoCode && <CopyCode code={o.promoCode} />}
              {o.menuItemSlug && (
                <Link
                  href={`/menu/${o.menuItemSlug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember-300 after:absolute after:inset-0 after:content-[''] hover:text-ember-200"
                >
                  {t("orderThis")}
                  <Arrow className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

import { MessageCircle, Timer, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FoodImage } from "@/components/brand/food-image";
import { OpenStatus } from "@/components/common/open-status";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import type { PublicSettings, Zone } from "@/types/catalog";
import { PHOTOS } from "@/server/db/seed/data";

export async function Hero({ settings, zones, locale }: { settings: PublicSettings; zones: Zone[]; locale: "ar" | "en" }) {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const minEta = Math.min(...zones.map((z) => z.etaMinMinutes));
  const maxEta = Math.min(...zones.map((z) => z.etaMaxMinutes));
  const minFee = Math.min(...zones.map((z) => z.feePiasters));
  const [line1, line2] = t("heroTitle").split("\n");
  const wa = `https://wa.me/${settings.restaurant.whatsapp}`;

  return (
    <section className="relative isolate -mt-16 overflow-hidden md:-mt-18">
      <FoodImage
        src={PHOTOS.flames}
        alt=""
        category="grills"
        priority
        sizes="100vw"
        className="absolute inset-0 -z-10 h-full w-full"
        imgClassName="object-[60%_50%] saturate-[1.05]"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-coal-900 via-coal-900/70 via-45% to-coal-900/5" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-l from-transparent via-coal-900/20 to-coal-900/80 rtl:bg-gradient-to-r" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[radial-gradient(60%_80%_at_50%_100%,rgb(255_138_69/0.18),transparent)]" />
      <div className="grain pointer-events-none absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto flex min-h-[86svh] max-w-7xl flex-col justify-end gap-7 px-4 pt-32 pb-12 sm:px-6 md:min-h-[760px] md:pb-20 lg:px-8">
        <div className="flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700">
          <span className="w-fit rounded-full border border-ember-400/30 bg-coal-950/50 px-3.5 py-1.5 text-xs font-semibold text-ember-300 backdrop-blur-md sm:text-sm">
            {t("eyebrow")}
          </span>
          <h1 className="max-w-3xl text-[2.9rem] leading-[1.12] text-cream-50 drop-shadow-[0_4px_30px_rgb(0_0_0/0.6)] sm:text-6xl lg:text-7xl">
            {line1}
            <br />
            <span className="text-ember-gradient">{line2}</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-smoke-200 sm:text-lg">{t("heroSubtitle")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both">
          <Button size="lg" asChild className="sm:min-w-52">
            <Link href="/menu">{tc("orderNow")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="border-cream-100/25 bg-coal-950/40 backdrop-blur-md">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              {tc("whatsapp")}
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          <OpenStatus rows={settings.hours} locale={locale} className="bg-coal-950/60 backdrop-blur-md" />
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-coal-950/60 px-3 py-1 text-smoke-200 backdrop-blur-md">
            <Timer className="size-4 text-ember-400" aria-hidden />
            {t("deliveryTime", { min: minEta, max: maxEta })}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-coal-950/60 px-3 py-1 text-smoke-200 backdrop-blur-md">
            <Truck className="size-4 text-ember-400" aria-hidden />
            {t("deliveryFrom", { fee: formatMoney(minFee, locale) })}
          </span>
        </div>
      </div>
    </section>
  );
}

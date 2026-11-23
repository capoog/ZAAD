/* eslint-disable @next/next/no-img-element -- tiny static brand mark */
import { Clock, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { formatPhone } from "@/lib/phone";
import type { PublicSettings } from "@/types/catalog";

export async function SiteFooter({ settings, locale }: { settings: PublicSettings; locale: "ar" | "en" }) {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const hours = await getTranslations("hours");
  const r = settings.restaurant;
  return (
    <footer className="relative mt-24 border-t border-border bg-coal-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-4">
          <Logo className="h-12 w-fit" />
          <p className="max-w-sm text-sm leading-relaxed text-smoke-300">{t("tagline")}</p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <h2 className="font-sans text-base font-semibold">{t("contact")}</h2>
          <a href={`tel:${r.phone}`} className="flex items-center gap-2 text-smoke-200 hover:text-ember-300">
            <Phone className="size-4 text-ember-400" aria-hidden />
            <span dir="ltr" className="tabular">
              {formatPhone(r.phone)}
            </span>
          </a>
          <p className="flex items-center gap-2 text-smoke-200">
            <MapPin className="size-4 text-ember-400" aria-hidden />
            {locale === "ar" ? r.addressAr : r.addressEn}
          </p>
          <p className="flex items-center gap-2 text-smoke-200">
            <Clock className="size-4 text-ember-400" aria-hidden />
            {hours("daily")}
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <h2 className="font-sans text-base font-semibold">{t("explore")}</h2>
          <Link href="/menu" className="text-smoke-200 hover:text-ember-300">
            {nav("menu")}
          </Link>
          <Link href="/#offers" className="text-smoke-200 hover:text-ember-300">
            {nav("offers")}
          </Link>
          <Link href="/orders" className="text-smoke-200 hover:text-ember-300">
            {nav("myOrders")}
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-smoke-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>{t("rights", { year: new Date().getFullYear() })}</span>
          <span>{t("madeWith")}</span>
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 pb-28 sm:px-6 md:pb-8 lg:px-8">
          <a
            href="https://www.instagram.com/seenlab.sa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-coal-850 py-1.5 ps-1.5 pe-4 text-sm text-smoke-300 transition-colors hover:border-[#C0FF72]/60"
          >
            {/* Seen studio mark (from the Seen brand book: lime on black, letter-only at small sizes). */}
            <img src="/brand/seen-mark.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
            {t("devBy")}
            <span className="font-display text-base font-bold text-[#C0FF72]">{t("devName")}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

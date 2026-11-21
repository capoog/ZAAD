import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight, Heart, MessageCircle, Phone, Plus, ShoppingBag, Utensils } from "lucide-react";
import { FoodImage } from "@/components/brand/food-image";
import { Logo } from "@/components/brand/logo";
import { Price } from "@/components/brand/price";
import { CartBar } from "@/components/cart/cart-bar";
import { EmptyState } from "@/components/common/empty-state";
import { LocaleSwitch } from "@/components/common/locale-switch";
import { OpenStatus } from "@/components/common/open-status";
import { DishCard, DishRow, type DishCardData } from "@/components/menu/dish-card";
import { DishTags } from "@/components/menu/dish-tags";
import { StatusTracker } from "@/components/order/status-tracker";
import { ChipsDemo, FormsDemo, ToastDemo } from "@/components/style-guide/interactive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fromCairoWallClock } from "@/lib/hours";
import { egp, type AppLocale } from "@/lib/money";
import * as seed from "@/server/db/seed/data";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

const HOURS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opensAt: "12:00", closesAt: "02:00", isClosed: false }));

function dish(slug: string, locale: AppLocale, overrides: Partial<DishCardData> = {}): DishCardData {
  const it = seed.items.find((i) => i.slug === slug);
  if (!it) throw new Error(slug);
  const prices = it.sizes?.map((s) => s.price) ?? [it.price];
  return {
    slug: it.slug,
    name: locale === "ar" ? it.nameAr : it.nameEn,
    description: locale === "ar" ? it.descriptionAr : it.descriptionEn,
    pricePiasters: egp(Math.min(...prices)),
    hasSizes: Boolean(it.sizes?.length),
    imageUrl: it.imageUrl,
    category: it.category,
    isSpicy: Boolean(it.spicy),
    isVegetarian: Boolean(it.vegetarian),
    isBestSeller: Boolean(it.bestSeller),
    isSoldOut: false,
    ...overrides,
  };
}

function Section({ index, title, children, note }: { index: string; title: string; children: ReactNode; note?: string }) {
  return (
    <section className="border-t border-border py-12 md:py-16">
      <div className="mb-8 flex flex-col gap-2">
        <span className="font-display text-sm text-ember-400" dir="ltr">
          {index}
        </span>
        <h2 className="text-2xl md:text-3xl">{title}</h2>
        {note && (
          <p dir="auto" className="max-w-2xl text-sm text-smoke-300">
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

const SWATCHES = [
  { group: "Charcoal", items: [["coal-950", "#0b0908"], ["coal-900", "#12100e"], ["coal-850", "#181512"], ["coal-800", "#1f1b17"], ["coal-700", "#2a241f"], ["coal-600", "#3a322b"]] },
  { group: "Ember", items: [["ember-200", "#ffcaa3"], ["ember-300", "#ffa86e"], ["ember-400", "#ff8a45"], ["ember-500", "#f26b1d"], ["ember-600", "#d4530f"], ["flame-400", "#ffc65c"]] },
  { group: "Cream · Smoke", items: [["cream-50", "#fbf6ee"], ["cream-100", "#f3e9da"], ["smoke-200", "#d6c9b8"], ["smoke-300", "#b9ab9c"], ["smoke-400", "#978878"], ["coal-500", "#574a3f"]] },
  { group: "Za'atar · Chili", items: [["zaatar-300", "#c3d08f"], ["zaatar-400", "#a9bb70"], ["zaatar-600", "#6b7a3a"], ["chili-400", "#ff6b5c"], ["chili-600", "#c8372a"], ["ember-900", "#3a1a0a"]] },
] as const;

const CONTRAST = [
  { fg: "cream-100", bg: "coal-900", ratio: "15.8" },
  { fg: "smoke-300", bg: "coal-900", ratio: "8.5" },
  { fg: "ember-400", bg: "coal-900", ratio: "8.1" },
  { fg: "coal-950", bg: "ember-400", ratio: "8.5" },
  { fg: "zaatar-400", bg: "coal-800", ratio: "8.2" },
  { fg: "chili-400", bg: "coal-800", ratio: "6.1" },
] as const;

export default async function StyleGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "en" ? "en" : "ar") as AppLocale;
  setRequestLocale(locale);
  const t = await getTranslations("styleGuide");
  const tc = await getTranslations("common");
  const tcart = await getTranslations("cart");
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const name = (x: { nameAr: string; nameEn: string }) => (locale === "ar" ? x.nameAr : x.nameEn);

  const kofta = seed.items.find((i) => i.slug === "grilled-kofta")!;
  const zones = seed.zones.map((z) => ({ slug: z.slug, name: name(z), fee: egp(z.fee) }));
  const sizes = (kofta.sizes ?? []).map((s, i) => ({ id: `s${i}`, name: name(s), price: egp(s.price) }));
  const addons = [
    ...seed.addonGroups.find((g) => g.slug === "grill-extras")!.addons,
    ...seed.addonGroups.find((g) => g.slug === "spicy")!.addons,
  ].map((a, i) => ({ id: `a${i}`, name: name(a), price: egp(a.price) }));

  // Fixed instants so the open/closed examples are deterministic.
  const openAt = fromCairoWallClock(2026, 11, 21, 21, 30);
  const closedAt = fromCairoWallClock(2026, 11, 21, 9, 15);

  return (
    <main id="main" className="relative mx-auto max-w-6xl px-4 pb-40 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="relative flex flex-col gap-8 overflow-hidden pt-8 pb-14 md:pt-14">
        <div className="flex items-center justify-between gap-4">
          <Logo className="h-11 md:h-14" />
          <LocaleSwitch />
        </div>
        <div className="flex flex-col gap-4">
          <Badge variant="ember" className="w-fit">
            Phase 1 · Design system
          </Badge>
          <h1 className="text-4xl leading-tight md:text-6xl">
            <span className="text-ember-gradient">{t("title")}</span>
          </h1>
          <p className="max-w-2xl text-base text-smoke-300 md:text-lg">{t("subtitle")}</p>
        </div>
      </header>

      {/* Logo */}
      <Section index="01" title={t("logo")}>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <Card className="grain grid min-h-52 place-items-center overflow-hidden bg-[radial-gradient(circle_at_70%_80%,rgb(255_138_69/0.18),transparent_60%)] p-8">
            <Logo className="h-20 md:h-24" />
          </Card>
          <Card className="grid min-h-52 place-items-center p-8">
            <Logo variant="mark" className="h-24" />
          </Card>
          <Card className="grid min-h-52 place-items-center bg-white p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mono.svg" alt="Monochrome logo for kitchen tickets" className="h-14 w-auto" />
          </Card>
        </div>
      </Section>

      {/* Colours */}
      <Section index="02" title={t("colors")} note="WCAG AA: every text/background pair used in the UI passes 4.5:1.">
        <div className="flex flex-col gap-6">
          {SWATCHES.map((g) => (
            <div key={g.group} className="flex flex-col gap-3">
              <h3 className="font-sans text-sm font-semibold text-smoke-300" dir="ltr">
                {g.group}
              </h3>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {g.items.map(([n, hex]) => (
                  <div key={n} className="overflow-hidden rounded-lg border border-border">
                    <div className="h-16" style={{ background: hex }} />
                    <div className="bg-coal-850 px-2.5 py-2 text-xs" dir="ltr">
                      <div className="font-semibold text-cream-100">{n}</div>
                      <div className="tabular text-smoke-300">{hex}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CONTRAST.map((c) => (
              <div
                key={c.fg + c.bg}
                className="flex flex-col gap-1 rounded-lg border border-border p-3"
                style={{ background: `var(--color-${c.bg})`, color: `var(--color-${c.fg})` }}
                dir="ltr"
              >
                <span className="font-display text-2xl">Aa أب</span>
                <span className="text-xs opacity-90">
                  {c.ratio}:1 · AA ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Typography */}
      <Section index="03" title={t("typography")} note="Reem Kufi (display, Kufic) · IBM Plex Sans Arabic (UI & body). Arabic is never letter-spaced.">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col gap-4 p-6">
            <span className="text-xs text-smoke-400" dir="ltr">
              Display — Reem Kufi 700 / 600
            </span>
            <p className="font-display text-5xl leading-tight">{t("displaySample")}</p>
            <p className="font-display text-3xl text-ember-300">مشويات · شاورما · فطائر</p>
            <p className="font-display text-2xl" dir="ltr">
              Fahm &amp; Zaatar
            </p>
          </Card>
          <Card className="flex flex-col gap-4 p-6">
            <span className="text-xs text-smoke-400" dir="ltr">
              Body — IBM Plex Sans Arabic 400 / 600
            </span>
            <p className="text-xl font-semibold">{name(kofta)}</p>
            <p className="leading-relaxed text-smoke-200">{t("bodySample")}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Price piasters={egp(220)} locale={locale} className="text-2xl text-cream-50" />
              <Price piasters={egp(1250.5)} locale={locale} className="text-lg text-smoke-200" />
              <span className="tabular text-lg text-smoke-200" dir="ltr">
                0100 000 0000
              </span>
            </div>
            <p className="text-xs text-smoke-400">{t("numbersSample")}</p>
          </Card>
        </div>
      </Section>

      {/* Buttons & badges */}
      <Section index="04" title={t("buttons")}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">
              {tc("orderNow")}
              <Arrow aria-hidden />
            </Button>
            <Button variant="secondary" size="lg">
              <Utensils aria-hidden />
              {tc("viewMenu")}
            </Button>
            <Button variant="outline" size="lg">
              <MessageCircle aria-hidden />
              {tc("whatsapp")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button>{tc("addToCart")}</Button>
            <Button variant="secondary">{tc("edit")}</Button>
            <Button variant="outline">
              <Phone aria-hidden />
              {tc("call")}
            </Button>
            <Button variant="ghost">{tc("cancel")}</Button>
            <Button variant="zaatar">{tc("save")}</Button>
            <Button variant="danger">{tc("remove")}</Button>
            <Button variant="link">{tc("viewMenu")}</Button>
            <Button disabled>{tc("soldOut")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">{tc("addToCart")}</Button>
            <Button size="icon" aria-label={tc("addToCart")}>
              <Plus aria-hidden />
            </Button>
            <Button size="icon" variant="secondary" aria-label="Favourite">
              <Heart aria-hidden />
            </Button>
            <Button size="icon-sm" variant="outline" aria-label={tc("addToCart")}>
              <Plus aria-hidden />
            </Button>
          </div>
          <h3 className="mt-4 font-sans text-sm font-semibold text-smoke-300">{t("badges")}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <DishTags bestSeller spicy vegetarian />
            <Badge variant="ember">WELCOME10</Badge>
            <Badge variant="solid">-10%</Badge>
            <Badge>{tc("soldOut")}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <OpenStatus rows={HOURS} locale={locale} now={openAt} />
            <OpenStatus rows={HOURS} locale={locale} now={closedAt} />
          </div>
        </div>
      </Section>

      {/* Dish cards */}
      <Section index="05" title={t("cards")}>
        <div className="mb-6">
          <ChipsDemo
            label="categories"
            items={seed.categories.map((c) => ({
              slug: c.slug,
              label: name(c),
              count: seed.items.filter((i) => i.category === c.slug).length,
            }))}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            dish("grilled-kofta", locale),
            dish("chicken-shawarma-arabi", locale),
            dish("nabulsi-kunafa", locale),
          ].map((d, i) => (
            <DishCard
              key={d.slug}
              dish={d}
              locale={locale}
              priority={i === 0}
              action={
                <Button size="icon" aria-label={`${tc("addToCart")}: ${d.name}`}>
                  <Plus aria-hidden />
                </Button>
              }
            />
          ))}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {[
            dish("shish-tawook", locale),
            dish("hummus", locale),
            dish("zaatar-manakish", locale),
            dish("lamb-chops", locale, { isSoldOut: true }),
          ].map((d) => (
            <DishRow
              key={d.slug}
              dish={d}
              locale={locale}
              action={
                <Button size="icon-sm" aria-label={`${tc("addToCart")}: ${d.name}`} disabled={d.isSoldOut}>
                  <Plus aria-hidden />
                </Button>
              }
            />
          ))}
        </div>
      </Section>

      {/* Forms */}
      <Section index="06" title={t("forms")}>
        <FormsDemo locale={locale} zones={zones} sizes={sizes} addons={addons} />
      </Section>

      {/* States */}
      <Section index="07" title={t("states")}>
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="flex flex-col gap-3 p-4">
            <span className="text-xs text-smoke-400">{t("skeleton")}</span>
            <Skeleton className="aspect-[4/3] rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="size-11 rounded-full" />
            </div>
          </Card>
          <Card className="flex flex-col">
            <span className="p-4 pb-0 text-xs text-smoke-400">{t("emptyState")}</span>
            <EmptyState
              icon={<ShoppingBag aria-hidden />}
              title={tcart("empty")}
              description={tcart("emptyHint")}
              action={
                <Button>
                  {tc("viewMenu")}
                  <Arrow aria-hidden />
                </Button>
              }
            />
          </Card>
          <Card className="flex flex-col gap-3 p-4">
            <span className="text-xs text-smoke-400">{t("photoFallback")}</span>
            <FoodImage
              src="https://images.unsplash.com/photo-0000000000000-broken?w=800"
              alt="fallback demo"
              category="grills"
              sizes="(min-width: 768px) 30vw, 90vw"
              className="aspect-[4/3] rounded-xl"
            />
            <p className="text-sm text-smoke-300">{t("photoFallbackHint")}</p>
            <div className="mt-auto">
              <ToastDemo />
            </div>
          </Card>
        </div>
      </Section>

      {/* Tracking + cart */}
      <Section index="08" title={t("tracking")}>
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <Card className="grain overflow-hidden p-6 md:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-smoke-300">#1042</p>
                <p className="font-display text-2xl">{(await getTranslations("status"))("preparing")}</p>
              </div>
              <Badge variant="ember">~ 25 {tc("minutes")}</Badge>
            </div>
            <StatusTracker status="preparing" fulfillment="delivery" />
          </Card>
          <Card className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-smoke-300">{tcart("subtotal")}</span>
              <Price piasters={egp(575)} locale={locale} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-smoke-300">{tcart("delivery")}</span>
              <Price piasters={egp(25)} locale={locale} />
            </div>
            <div className="flex items-center justify-between text-sm text-zaatar-300">
              <span>
                {tcart("discount")} · WELCOME10
              </span>
              <span>
                −<Price piasters={egp(57.5)} locale={locale} />
              </span>
            </div>
            <div className="hairline" />
            <div className="flex items-center justify-between">
              <span className="font-semibold">{tcart("total")}</span>
              <Price piasters={egp(542.5)} locale={locale} className="text-xl text-cream-50" />
            </div>
            <p className="text-xs text-smoke-400">{tcart("vatIncluded", { rate: 14 })}</p>
            <CartBar count={3} totalPiasters={egp(542.5)} locale={locale} floating={false} className="mt-2 [&>button]:md:w-full" />
          </Card>
        </div>
      </Section>

    </main>
  );
}

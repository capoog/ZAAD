import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FoodImage } from "@/components/brand/food-image";
import { Price } from "@/components/brand/price";
import { AddButton } from "@/components/menu/add-button";
import { DishCard } from "@/components/menu/dish-card";
import { DishTags } from "@/components/menu/dish-tags";
import { ItemOptions } from "@/components/menu/item-options";
import { Link } from "@/i18n/navigation";
import { minPrice, toDishCard } from "@/lib/dish";
import { alternatesFor } from "@/lib/seo/site";
import { getMenu } from "@/server/services/catalog";

async function findItem(slug: string) {
  const menu = await getMenu();
  const items = menu.flatMap((c) => c.items);
  const item = items.find((i) => i.slug === slug);
  return { item, items, category: menu.find((c) => c.id === item?.categoryId) };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const { item } = await findItem(slug);
  if (!item) return {};
  const name = locale === "ar" ? item.nameAr : item.nameEn;
  const description = (locale === "ar" ? item.descriptionAr : item.descriptionEn) ?? undefined;
  return {
    title: name,
    description,
    alternates: alternatesFor(`/menu/${slug}`, locale),
    openGraph: { title: name, description, images: item.imageUrl?.startsWith("http") ? [item.imageUrl] : undefined },
  };
}

export default async function ItemPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  setRequestLocale(raw);
  const locale = raw === "en" ? "en" : "ar";
  const { item, items, category } = await findItem(slug);
  if (!item) notFound();
  const t = await getTranslations("item");
  const tc = await getTranslations("common");
  const L = (ar: string | null, en: string | null) => (locale === "ar" ? ar : en) ?? "";
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;
  const related = items.filter((i) => i.categoryId === item.categoryId && i.id !== item.id && !i.isSoldOut).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-0 pb-16 md:px-6 md:pt-8 lg:px-8">
      <div className="md:grid md:grid-cols-2 md:gap-10 lg:gap-14">
        <div className="relative md:sticky md:top-28 md:self-start">
          <FoodImage
            src={item.imageUrl}
            alt={L(item.nameAr, item.nameEn)}
            category={item.categorySlug}
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="aspect-[4/3] md:rounded-3xl md:border md:border-border md:shadow-lift"
            imgClassName={item.isSoldOut ? "grayscale" : undefined}
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-coal-900 to-transparent md:hidden" />
          <Link
            href="/menu"
            aria-label={t("backToMenu")}
            className="absolute start-4 top-4 grid size-11 place-items-center rounded-full bg-coal-950/70 text-cream-50 backdrop-blur-md md:hidden"
          >
            <Back className="size-5" aria-hidden />
          </Link>
        </div>

        <div className="relative -mt-6 rounded-t-3xl bg-coal-900 px-4 pt-6 md:mt-0 md:rounded-none md:bg-transparent md:px-0 md:pt-0">
          <nav aria-label="breadcrumb" className="mb-4 hidden items-center gap-2 text-sm text-smoke-400 md:flex">
            <Link href="/menu" className="hover:text-ember-300">
              {t("backToMenu")}
            </Link>
            <span aria-hidden>/</span>
            <Link href={`/menu#${category?.slug}`} className="hover:text-ember-300">
              {L(category?.nameAr ?? "", category?.nameEn ?? "")}
            </Link>
          </nav>
          <div className="flex flex-wrap gap-1.5">
            <DishTags spicy={item.isSpicy} vegetarian={item.isVegetarian} bestSeller={item.isBestSeller} />
          </div>
          <h1 className="mt-3 text-3xl leading-tight md:text-5xl">{L(item.nameAr, item.nameEn)}</h1>
          <p className="mt-3 text-base leading-relaxed text-smoke-200">{L(item.descriptionAr, item.descriptionEn)}</p>
          <div className="mt-4 flex items-baseline gap-2">
            {item.sizes.length > 1 && <span className="text-sm text-smoke-300">{tc("from")}</span>}
            <Price piasters={minPrice(item)} locale={locale} className="text-2xl text-ember-300" />
          </div>
          {item.isSoldOut && (
            <p className="mt-4 rounded-xl border border-chili-400/30 bg-chili-900/60 p-4 text-sm text-chili-400">{t("soldOutHint")}</p>
          )}
          <div className="hairline my-7" />
          <ItemOptions item={item} />
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-16 px-4 md:px-0">
          <h2 id="related" className="mb-5 text-2xl md:text-3xl">
            {t("youMightLike")}
          </h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {related.map((r) => (
              <div key={r.id} className="w-[72vw] max-w-xs shrink-0 snap-start md:w-auto md:max-w-none">
                <DishCard dish={toDishCard(r, locale)} locale={locale} href={`/menu/${r.slug}`} action={<AddButton slug={r.slug} />} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

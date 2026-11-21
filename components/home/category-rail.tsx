import { getTranslations } from "next-intl/server";
import { FoodImage } from "@/components/brand/food-image";
import { Link } from "@/i18n/navigation";
import type { MenuCategory } from "@/types/catalog";
import { SectionHeading } from "./section-heading";

export async function CategoryRail({ menu, locale }: { menu: MenuCategory[]; locale: "ar" | "en" }) {
  const t = await getTranslations("home");
  const tm = await getTranslations("menu");
  return (
    <section aria-labelledby="cats" className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
      <SectionHeading id="cats" title={t("categoriesTitle")} />
      <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
        {menu.map((c) => (
          <li key={c.slug} className="w-36 shrink-0 snap-start sm:w-auto">
            <Link
              href={`/menu#${c.slug}`}
              className="group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-ember-400/40"
            >
              <FoodImage
                src={c.imageUrl}
                alt=""
                category={c.slug}
                sizes="(min-width: 1024px) 15vw, (min-width: 640px) 30vw, 9rem"
                className="aspect-[4/5]"
                imgClassName="group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-coal-950 via-coal-950/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col p-3">
                <span className="font-display text-lg leading-tight text-cream-50">{locale === "ar" ? c.nameAr : c.nameEn}</span>
                <span className="text-xs text-smoke-300">{tm("items", { count: c.items.length })}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

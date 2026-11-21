import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FoodImage } from "@/components/brand/food-image";
import { Price } from "@/components/brand/price";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/lib/money";
import { DishTags } from "./dish-tags";

export interface DishCardData {
  slug: string;
  name: string;
  description: string;
  pricePiasters: number;
  hasSizes: boolean;
  imageUrl: string | null;
  category: string;
  isSpicy: boolean;
  isVegetarian: boolean;
  isBestSeller: boolean;
  isSoldOut: boolean;
}

/** Large photo card — home page featured dishes and desktop menu grid. */
export function DishCard({
  dish,
  locale,
  action,
  priority = false,
  href,
}: {
  dish: DishCardData;
  locale: AppLocale;
  action?: ReactNode;
  priority?: boolean;
  href?: string;
}) {
  const t = useTranslations("common");
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-border-strong hover:shadow-lift has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ember-400",
        dish.isSoldOut && "opacity-70",
      )}
    >
      <div className="relative">
        <FoodImage
          src={dish.imageUrl}
          alt={dish.name}
          category={dish.category}
          priority={priority}
          sizes="(min-width: 1280px) 22rem, (min-width: 768px) 33vw, 92vw"
          className="aspect-[4/3]"
          imgClassName={cn("group-hover:scale-[1.04]", dish.isSoldOut && "grayscale")}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
          <DishTags glass spicy={dish.isSpicy} vegetarian={dish.isVegetarian} bestSeller={dish.isBestSeller} />
        </div>
        {dish.isSoldOut && (
          <div className="absolute inset-0 grid place-items-center bg-coal-950/55 backdrop-blur-[2px]">
            <span className="rounded-full border border-border-strong bg-coal-900/80 px-4 py-1.5 text-sm font-semibold">
              {t("soldOut")}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-1">
        <h3 className="font-sans text-lg font-semibold leading-snug">
          <CardLink href={href}>{dish.name}</CardLink>
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-smoke-300">{dish.description}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <div className="flex items-baseline gap-1.5">
            {dish.hasSizes && <span className="text-xs text-smoke-300">{t("from")}</span>}
            <Price piasters={dish.pricePiasters} locale={locale} className="text-lg text-cream-50" />
          </div>
          {action && <div className="relative z-10">{action}</div>}
        </div>
      </div>
    </article>
  );
}

/** Compact row — mobile menu list. Photo on the inline-start side. */
export function DishRow({
  dish,
  locale,
  action,
  href,
}: {
  dish: DishCardData;
  locale: AppLocale;
  action?: ReactNode;
  href?: string;
}) {
  const t = useTranslations("common");
  return (
    <article
      className={cn(
        "group relative flex gap-3.5 rounded-2xl border border-border bg-card/70 p-2.5 shadow-card transition-colors hover:border-border-strong has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ember-400",
        dish.isSoldOut && "opacity-70",
      )}
    >
      <FoodImage
        src={dish.imageUrl}
        alt={dish.name}
        category={dish.category}
        sizes="128px"
        className="size-28 shrink-0 rounded-xl sm:size-32"
        imgClassName={dish.isSoldOut ? "grayscale" : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1 pe-1">
        <div className="flex flex-wrap gap-1">
          <DishTags spicy={dish.isSpicy} vegetarian={dish.isVegetarian} bestSeller={dish.isBestSeller} />
        </div>
        <h3 className="font-sans text-base font-semibold leading-snug">
          <CardLink href={href}>{dish.name}</CardLink>
        </h3>
        <p className="line-clamp-2 text-[0.8rem] leading-relaxed text-smoke-300">{dish.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {dish.isSoldOut ? (
            <span className="text-sm font-semibold text-smoke-300">{t("soldOut")}</span>
          ) : (
            <div className="flex items-baseline gap-1">
              {dish.hasSizes && <span className="text-[0.7rem] text-smoke-300">{t("from")}</span>}
              <Price piasters={dish.pricePiasters} locale={locale} className="text-cream-50" />
            </div>
          )}
          {action && <div className="relative z-10">{action}</div>}
        </div>
      </div>
    </article>
  );
}

/** Stretched link: the whole card is clickable while buttons inside stay separate controls. */
function CardLink({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="outline-none after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-['']">
      {children}
    </Link>
  );
}

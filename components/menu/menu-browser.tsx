"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Leaf, Search, SearchX, Star, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Button } from "@/components/ui/button";
import { inputBase } from "@/components/ui/input";
import { toDishCard } from "@/lib/dish";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/catalog";
import { AddButton } from "./add-button";
import { CategoryChips } from "./category-chips";
import { DishCard, DishRow } from "./dish-card";

type Filter = "spicy" | "vegetarian" | "bestSeller";

/** Arabic-insensitive search: strips diacritics/tatweel and unifies alef/yaa/taa marbuta. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

export function MenuBrowser() {
  const { menu } = useCatalog();
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("menu");
  const tt = useTranslations("tags");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [active, setActive] = useState(menu[0]?.slug ?? "");
  const lockSpy = useRef(false);

  const matches = (item: MenuItem) => {
    if (filters.includes("spicy") && !item.isSpicy) return false;
    if (filters.includes("vegetarian") && !item.isVegetarian) return false;
    if (filters.includes("bestSeller") && !item.isBestSeller) return false;
    if (!query.trim()) return true;
    const q = normalize(query);
    return [item.nameAr, item.nameEn, item.descriptionAr ?? "", item.descriptionEn ?? ""].some((f) => normalize(f).includes(q));
  };

  const sections = useMemo(
    () => menu.map((c) => ({ ...c, items: c.items.filter(matches) })).filter((c) => c.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menu, query, filters],
  );

  // Scroll-spy: highlight the category currently under the sticky bars.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.slug)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        if (lockSpy.current) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  // Deep links like /menu#shawarma
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && document.getElementById(id)) {
      setActive(id);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    }
  }, []);

  const jump = (slug: string) => {
    setActive(slug);
    lockSpy.current = true;
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${slug}`);
    window.setTimeout(() => (lockSpy.current = false), 900);
  };

  const toggle = (f: Filter) => setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const filterDefs: { key: Filter; label: string; icon: typeof Flame; on: string }[] = [
    { key: "bestSeller", label: tt("bestSeller"), icon: Star, on: "border-flame-400 bg-flame-400/15 text-flame-300" },
    { key: "spicy", label: tt("spicy"), icon: Flame, on: "border-chili-400 bg-chili-900 text-chili-400" },
    { key: "vegetarian", label: tt("vegetarian"), icon: Leaf, on: "border-zaatar-400 bg-zaatar-900 text-zaatar-300" },
  ];
  const L = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const hasCriteria = query.trim() !== "" || filters.length > 0;

  return (
    <div>
      {/* Search + filters */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative block flex-1 md:max-w-md">
            <span className="sr-only">{t("searchPlaceholder")}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-smoke-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              enterKeyHint="search"
              className={cn(inputBase, "h-12 rounded-full ps-12 pe-11")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("clearFilters")}
                className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-coal-700 text-smoke-200"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("filters")}>
            {filterDefs.map(({ key, label, icon: Icon, on }) => {
              const pressed = filters.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggle(key)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
                    pressed ? on : "border-border-strong bg-coal-850 text-smoke-200 hover:border-smoke-400",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky category bar */}
      <div className="sticky top-16 z-30 mt-5 border-y border-border bg-coal-900/85 py-2.5 backdrop-blur-xl md:top-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <CategoryChips
            ariaLabel={t("categories")}
            active={active}
            onSelect={jump}
            items={sections.map((c) => ({ slug: c.slug, label: L(c.nameAr, c.nameEn), count: c.items.length }))}
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {sections.length === 0 ? (
          <EmptyState
            icon={<SearchX aria-hidden />}
            title={t("noResults")}
            description={t("noResultsHint")}
            action={
              hasCriteria ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilters([]);
                  }}
                >
                  {t("clearFilters")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          sections.map((c) => (
            <section key={c.slug} id={c.slug} aria-labelledby={`h-${c.slug}`} className="scroll-mt-36 pt-9 md:scroll-mt-40 md:pt-12">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 id={`h-${c.slug}`} className="text-2xl md:text-3xl">
                    {L(c.nameAr, c.nameEn)}
                  </h2>
                  {L(c.descriptionAr ?? "", c.descriptionEn ?? "") && (
                    <p className="mt-1 text-sm text-smoke-300">{L(c.descriptionAr ?? "", c.descriptionEn ?? "")}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-smoke-400">{t("items", { count: c.items.length })}</span>
              </div>
              {/* Mobile: compact rows · Desktop: photo cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {c.items.map((item) => (
                  <DishRow
                    key={item.id}
                    dish={toDishCard(item, locale)}
                    locale={locale}
                    href={`/menu/${item.slug}`}
                    action={<AddButton slug={item.slug} size="icon-sm" />}
                  />
                ))}
              </div>
              <div className="hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3">
                {c.items.map((item) => (
                  <DishCard
                    key={item.id}
                    dish={toDishCard(item, locale)}
                    locale={locale}
                    href={`/menu/${item.slug}`}
                    action={<AddButton slug={item.slug} />}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

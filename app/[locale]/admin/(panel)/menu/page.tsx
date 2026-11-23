import { getTranslations, setRequestLocale } from "next-intl/server";
import { EyeOff, Pencil, Plus } from "lucide-react";
import { FoodImage } from "@/components/brand/food-image";
import { Price } from "@/components/brand/price";
import { SoldOutToggle } from "@/components/admin/sold-out-toggle";
import { DishTags } from "@/components/menu/dish-tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { minPrice } from "@/lib/dish";
import { requireStaffPage } from "@/server/auth/guard";
import { getMenuFresh } from "@/server/services/catalog";

export default async function AdminMenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw === "en" ? "en" : "ar";
  const session = await requireStaffPage(raw, ["owner", "manager", "kitchen"]);
  const canEdit = session.roles.some((r) => r === "owner" || r === "manager");
  const t = await getTranslations("admin.menu");
  const menu = await getMenuFresh(true);
  const L = (ar: string | null, en: string | null) => (locale === "ar" ? ar : en) ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
        {canEdit && (
          <Button asChild>
            <Link href="/admin/menu/new">
              <Plus aria-hidden />
              {t("newItem")}
            </Link>
          </Button>
        )}
      </div>
      {menu.map((c) => (
        <section key={c.id} aria-labelledby={`c-${c.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <h2 id={`c-${c.id}`} className="mb-3 flex items-center gap-2 font-sans text-lg font-semibold">
            {L(c.nameAr, c.nameEn)}
            <span className="tabular rounded-full bg-coal-700 px-2 text-xs">{c.items.length}</span>
          </h2>
          <ul className="divide-y divide-border">
            {c.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 py-3">
                <FoodImage src={it.imageUrl} alt="" category={c.slug} sizes="56px" className="size-14 shrink-0 rounded-lg" imgClassName={it.isSoldOut ? "grayscale" : undefined} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {L(it.nameAr, it.nameEn)}
                    {!it.isActive && (
                      <Badge>
                        <EyeOff aria-hidden />
                        {t("hidden")}
                      </Badge>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-smoke-300">
                    <Price piasters={minPrice(it)} locale={locale} />
                    {it.sizes.length > 1 && <span>· {it.sizes.map((s) => L(s.nameAr, s.nameEn)).join(" / ")}</span>}
                    <DishTags spicy={it.isSpicy} vegetarian={it.isVegetarian} bestSeller={it.isBestSeller} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className={it.isSoldOut ? "text-chili-400" : "text-zaatar-300"}>{it.isSoldOut ? t("soldOut") : t("available")}</span>
                  <SoldOutToggle itemId={it.id} soldOut={it.isSoldOut} label={`${t("available")}: ${L(it.nameAr, it.nameEn)}`} />
                </label>
                {canEdit && (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/admin/menu/${it.id}`}>
                      <Pencil aria-hidden />
                      {t("edit")}
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AddButton } from "@/components/menu/add-button";
import { DishCard } from "@/components/menu/dish-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toDishCard } from "@/lib/dish";
import type { MenuItem } from "@/types/catalog";
import { SectionHeading } from "./section-heading";

export async function Featured({ items, locale }: { items: MenuItem[]; locale: "ar" | "en" }) {
  const t = await getTranslations("home");
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  return (
    <section aria-labelledby="featured" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
      <SectionHeading
        id="featured"
        title={t("featuredTitle")}
        subtitle={t("featuredSubtitle")}
        action={
          <Button variant="link" asChild className="hidden sm:inline-flex">
            <Link href="/menu">
              {t("seeAll")}
              <Arrow aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:px-0 lg:grid-cols-3">
        {items.map((item, i) => (
          <div key={item.id} className="w-[78vw] max-w-sm shrink-0 snap-start md:w-auto md:max-w-none">
            <DishCard
              dish={toDishCard(item, locale)}
              locale={locale}
              priority={i < 2}
              href={`/menu/${item.slug}`}
              action={<AddButton slug={item.slug} />}
            />
          </div>
        ))}
      </div>
      <Button variant="secondary" asChild className="mt-4 w-full sm:hidden">
        <Link href="/menu">
          {t("seeAll")}
          <Arrow aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

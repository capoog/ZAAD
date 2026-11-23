import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { Link } from "@/i18n/navigation";
import { MANAGERS, requireStaffPage } from "@/server/auth/guard";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { getMenuFresh } from "@/server/services/catalog";

export default async function EditMenuItemPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireStaffPage(locale, MANAGERS);
  const t = await getTranslations("admin.menu");
  const menu = await getMenuFresh(true);
  const item = id === "new" ? null : (menu.flatMap((c) => c.items).find((i) => i.id === id) ?? null);
  if (id !== "new" && !item) notFound();
  const db = await getDb();
  const [groups, addonRows] = await Promise.all([db.select().from(s.addonGroups).orderBy(asc(s.addonGroups.sortOrder)), db.select().from(s.addons)]);
  const Back = locale === "ar" ? ArrowRight : ArrowLeft;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/menu" className="flex w-fit items-center gap-2 text-sm text-smoke-300 hover:text-ember-300">
        <Back className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="text-3xl">{item ? (locale === "ar" ? item.nameAr : item.nameEn) : t("newItem")}</h1>
      <MenuItemForm
        item={item}
        categories={menu.map((c) => ({ id: c.id, slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn }))}
        groups={groups.map((g) => ({
          id: g.id,
          nameAr: g.nameAr,
          nameEn: g.nameEn,
          addons: addonRows
            .filter((a) => a.groupId === g.id)
            .map((a) => `${locale === "ar" ? a.nameAr : a.nameEn} (${a.pricePiasters / 100})`)
            .join(" · "),
        }))}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { jsonLdString, menuJsonLd } from "@/lib/seo/jsonld";
import { alternatesFor } from "@/lib/seo/site";
import { getMenu } from "@/server/services/catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "menu" });
  return { title: t("title"), description: t("subtitle"), alternates: alternatesFor("/menu", locale) };
}

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("menu");
  const menu = await getMenu();
  return (
    <div className="pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(menuJsonLd(menu, locale === "en" ? "en" : "ar")) }} />
      <header className="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 md:pt-12 lg:px-8">
        <h1 className="text-4xl md:text-5xl">{t("title")}</h1>
        <p className="mt-2 text-smoke-300">{t("subtitle")}</p>
      </header>
      <MenuBrowser />
    </div>
  );
}

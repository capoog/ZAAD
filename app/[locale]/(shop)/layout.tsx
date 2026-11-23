import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { IntroSplash } from "@/components/intro/intro-splash";
import { FloatingActions } from "@/components/layout/floating-actions";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CatalogProvider } from "@/components/providers/catalog-provider";
import { getMenu, getPublicSettings, getZones } from "@/server/services/catalog";

// Menu, prices and hours come from the database on each request (cached
// server-side and invalidated by admin edits), never baked in at build time.
export const dynamic = "force-dynamic";

export default async function ShopLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [menu, zones, settings] = await Promise.all([getMenu(), getZones(), getPublicSettings()]);
  return (
    <CatalogProvider menu={menu} zones={zones} settings={settings}>
      <IntroSplash />
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} locale={locale === "en" ? "en" : "ar"} />
      <FloatingActions />
    </CatalogProvider>
  );
}

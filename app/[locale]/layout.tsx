import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { kufi, plex } from "@/lib/fonts";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: t("title"), template: `%s | ${t("short")}` },
    description: t("description"),
    icons: { icon: "/brand/app-icon.svg", apple: "/brand/app-icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#12100e",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${plex.variable} ${kufi.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          {children}
          <Toaster dir={locale === "ar" ? "rtl" : "ltr"} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

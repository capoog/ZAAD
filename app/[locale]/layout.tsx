import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ServiceWorkerRegister } from "@/components/common/sw-register";
import { Toaster } from "@/components/ui/sonner";
import { alternatesFor, SITE_URL } from "@/lib/seo/site";
import { routing } from "@/i18n/routing";
import { kufi, plex } from "@/lib/fonts";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s | ${t("short")}` },
    description: t("description"),
    applicationName: t("short"),
    alternates: alternatesFor("/", locale),
    icons: { icon: [{ url: "/brand/app-icon.svg", type: "image/svg+xml" }, { url: "/icon.png", sizes: "48x48" }], apple: "/brand/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: t("short"), statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    openGraph: {
      type: "website",
      siteName: t("short"),
      title: t("title"),
      description: t("description"),
      locale: locale === "ar" ? "ar_EG" : "en_US",
      alternateLocale: locale === "ar" ? "en_US" : "ar_EG",
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: t("short") }],
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: ["/og.jpg"] },
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
      <head>
        {/* Decide before first paint whether to play the intro (once per session, never for reduced motion). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var f=location.search.indexOf("intro=1")>-1;if(!f&&(sessionStorage.getItem("fz-intro-seen")||matchMedia("(prefers-reduced-motion: reduce)").matches||navigator.webdriver)){document.documentElement.dataset.intro="skip"}}catch(e){}`,
          }}
        />
      </head>
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
          <ServiceWorkerRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

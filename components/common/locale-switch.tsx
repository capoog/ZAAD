"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const target = locale === "ar" ? "en" : "ar";
  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      aria-label={t("languageSwitch")}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-sm font-semibold text-cream-100 transition-colors hover:border-ember-400/60 hover:bg-coal-800",
        className,
      )}
    >
      <Languages className="size-4 text-ember-400" aria-hidden />
      <span lang={target}>{t("language")}</span>
    </Link>
  );
}

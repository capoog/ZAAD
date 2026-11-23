"use client";

import { BarChart3, ClipboardList, ExternalLink, Settings, UsersRound, UtensilsCrossed, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS = { orders: ClipboardList, menu: UtensilsCrossed, instapay: Zap, analytics: BarChart3, settings: Settings, staff: UsersRound } as const;
export type AdminSection = keyof typeof ICONS;

export function AdminNav({ sections, pendingInstapay, variant }: { sections: AdminSection[]; pendingInstapay: number; variant: "side" | "bottom" }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  if (variant === "bottom") {
    return (
      <nav aria-label="admin" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-coal-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {sections.map((s) => {
          const Icon = ICONS[s];
          const on = pathname.startsWith(`/admin/${s}`);
          return (
            <Link key={s} href={`/admin/${s}`} aria-current={on ? "page" : undefined} className={cn("relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium", on ? "text-ember-400" : "text-smoke-300")}>
              <Icon className="size-5" aria-hidden />
              {t(s)}
              {s === "instapay" && pendingInstapay > 0 && (
                <span className="absolute end-[calc(50%-1.4rem)] top-1.5 grid min-w-4.5 place-items-center rounded-full bg-ember-400 px-1 text-[0.65rem] font-bold text-coal-950">{pendingInstapay}</span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="admin" className="flex flex-col gap-1">
      {sections.map((s) => {
        const Icon = ICONS[s];
        const on = pathname.startsWith(`/admin/${s}`);
        return (
          <Link
            key={s}
            href={`/admin/${s}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition-colors",
              on ? "bg-ember-400 text-coal-950" : "text-smoke-200 hover:bg-coal-800 hover:text-cream-50",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="flex-1">{t(s)}</span>
            {s === "instapay" && pendingInstapay > 0 && (
              <span className={cn("grid min-w-5.5 place-items-center rounded-full px-1.5 text-xs font-bold", on ? "bg-coal-950 text-ember-300" : "bg-ember-400 text-coal-950")}>{pendingInstapay}</span>
            )}
          </Link>
        );
      })}
      <Link href="/" className="mt-2 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-smoke-300 hover:bg-coal-800">
        <ExternalLink className="size-4" aria-hidden />
        {t("viewSite")}
      </Link>
    </nav>
  );
}

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Price } from "@/components/brand/price";
import type { AppLocale } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Floating cart button with live count + total (mobile bottom bar / desktop corner pill). */
export function CartBar({
  count,
  totalPiasters,
  locale,
  className,
  floating = true,
}: {
  count: number;
  totalPiasters: number;
  locale: AppLocale;
  className?: string;
  floating?: boolean;
}) {
  const t = useTranslations("cart");
  return (
    <div
      className={cn(
        floating && "fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:end-6 md:bottom-6 md:px-0",
        className,
      )}
    >
      <button
        type="button"
        className="group flex h-16 w-full items-center gap-3 rounded-full bg-ember-400 bg-[linear-gradient(180deg,rgb(255_255_255/0.2),transparent_60%)] ps-2 pe-6 text-coal-950 shadow-ember-lg transition-transform active:scale-[0.98] md:w-96"
      >
        <span className="relative grid size-12 place-items-center rounded-full bg-coal-950 text-ember-400">
          <ShoppingBag className="size-5" aria-hidden />
          <span className="tabular absolute -end-1 -top-1 grid min-w-6 place-items-center rounded-full border-2 border-ember-400 bg-cream-50 px-1 text-xs font-bold text-coal-950">
            {count}
          </span>
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[0.95rem] font-bold">{t("viewCart")}</span>
          <span className="text-xs font-medium text-coal-950/70">{t("items", { count })}</span>
        </span>
        <Price piasters={totalPiasters} locale={locale} className="ms-auto text-lg font-bold" />
      </button>
    </div>
  );
}

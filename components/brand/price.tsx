import { formatMoney, type AppLocale } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  piasters,
  locale,
  className,
  strike = false,
}: {
  piasters: number;
  locale: AppLocale;
  className?: string;
  strike?: boolean;
}) {
  return (
    <span className={cn("tabular whitespace-nowrap font-semibold", strike && "text-smoke-400 line-through", className)}>
      {/* <bdi> isolates the amount so it never reorders surrounding text. */}
      <bdi>{formatMoney(piasters, locale)}</bdi>
    </span>
  );
}

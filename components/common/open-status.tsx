import { useTranslations } from "next-intl";
import { formatClock, getOpenStatus, type OpeningHoursRow } from "@/lib/hours";
import { cn } from "@/lib/utils";

export function OpenStatus({
  rows,
  locale,
  now = new Date(),
  className,
}: {
  rows: OpeningHoursRow[];
  locale: "ar" | "en";
  now?: Date;
  className?: string;
}) {
  const t = useTranslations("hours");
  const st = getOpenStatus(now, rows);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        st.isOpen ? "border-zaatar-400/30 bg-zaatar-900/70 text-zaatar-300" : "border-chili-400/30 bg-chili-900/70 text-chili-400",
        className,
      )}
    >
      <span className="relative flex size-2">
        {st.isOpen && <span className="absolute inline-flex size-full animate-ping rounded-full bg-zaatar-400 opacity-60" />}
        <span className={cn("relative inline-flex size-2 rounded-full", st.isOpen ? "bg-zaatar-400" : "bg-chili-400")} />
      </span>
      {st.isOpen ? t("openNow") : t("closedNow")}
      <span className="text-current/80">
        ·{" "}
        {st.isOpen && st.closesAt
          ? t("closesAt", { time: formatClock(st.closesAt, locale) })
          : st.opensAt
            ? t("opensAt", { time: formatClock(st.opensAt, locale) })
            : null}
      </span>
    </span>
  );
}

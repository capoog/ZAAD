import { getTranslations, setRequestLocale } from "next-intl/server";
import { TrendingDown, TrendingUp } from "lucide-react";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MANAGERS, requireStaffPage } from "@/server/auth/guard";
import { getAnalytics } from "@/server/services/analytics";

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  await requireStaffPage(raw, MANAGERS);
  const locale = raw === "en" ? "en" : "ar";
  const { days: d } = await searchParams;
  const days = [7, 14, 30].includes(Number(d)) ? Number(d) : 14;
  const t = await getTranslations("admin.analytics");
  const data = await getAnalytics(days);
  const delta = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
  const kpis = [
    { label: t("sales"), value: formatMoney(data.totals.salesPiasters, locale), delta: delta(data.totals.salesPiasters, data.previous.salesPiasters) },
    { label: t("orders"), value: String(data.totals.orders), delta: delta(data.totals.orders, data.previous.orders) },
    { label: t("aov"), value: formatMoney(data.totals.aovPiasters, locale), delta: null },
    { label: t("delivered"), value: String(data.totals.delivered), delta: null },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
        <div className="flex gap-1 rounded-full border border-border-strong bg-coal-850 p-1" role="group" aria-label={t("title")}>
          {[7, 14, 30].map((n) => (
            <Link key={n} href={`/admin/analytics?days=${n}`} aria-current={n === days ? "true" : undefined} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", n === days ? "bg-ember-400 text-coal-950" : "text-smoke-200 hover:text-cream-50")}>
              {t("range", { days: n })}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs text-smoke-400">{k.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold text-cream-50">{k.value}</p>
            {k.delta !== null && (
              <p className={cn("mt-1 flex items-center gap-1 text-xs", k.delta >= 0 ? "text-zaatar-300" : "text-chili-400")}>
                {k.delta >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                <bdi dir="ltr">{k.delta >= 0 ? "+" : ""}{k.delta}%</bdi> {t("vsPrev")}
              </p>
            )}
          </div>
        ))}
      </div>
      <AnalyticsCharts data={data} />
    </div>
  );
}

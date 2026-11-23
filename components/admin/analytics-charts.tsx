"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import type { Analytics } from "@/server/services/analytics";

const EMBER = "#ff8a45";
const GRID = "rgba(243,233,218,0.08)";
const AXIS = { fill: "#b9ab9c", fontSize: 11 };
const PALETTE = ["#ff8a45", "#ffc65c", "#a9bb70", "#ffa86e", "#c3d08f", "#f26b1d"];

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 shadow-card ${className ?? ""}`}>
      <h2 className="mb-3 font-sans text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TooltipBox({ active, payload, label, money }: { active?: boolean; payload?: { value: number }[]; label?: string; money?: boolean }) {
  const locale = useLocale() as "ar" | "en";
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-coal-800 px-3 py-2 text-xs shadow-lift">
      <p className="text-smoke-300">{label}</p>
      <p className="tabular font-semibold text-cream-50">{money ? formatMoney(payload[0]!.value, locale) : payload[0]!.value}</p>
    </div>
  );
}

export function AnalyticsCharts({ data }: { data: Analytics }) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("admin.analytics");
  const tp = useTranslations("payment");
  const rtl = locale === "ar";
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const daily = data.daily.map((d) => ({ ...d, label: dayFmt.format(new Date(`${d.day}T00:00:00Z`)) }));
  const hours = data.byHour.map((h) => ({ ...h, label: `${((h.hour + 11) % 12) + 1}${h.hour < 12 ? (rtl ? "ص" : "a") : rtl ? "م" : "p"}` }));
  const L = (ar: string, en: string) => (rtl ? ar : en);
  const maxArea = Math.max(1, ...data.byArea.map((a) => a.orders));
  const totalPay = Math.max(1, data.byPayment.reduce((s, p) => s + p.orders, 0));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard title={t("dailySales")} className="xl:col-span-2">
        <div className="h-64" dir="ltr">
          <ResponsiveContainer>
            <AreaChart data={daily} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={EMBER} stopOpacity={0.45} />
                  <stop offset="1" stopColor={EMBER} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} reversed={rtl} minTickGap={16} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} orientation={rtl ? "right" : "left"} tickFormatter={(v: number) => `${Math.round(v / 100)}`} />
              <Tooltip content={<TooltipBox money />} cursor={{ stroke: EMBER, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="salesPiasters" stroke={EMBER} strokeWidth={2.5} fill="url(#salesFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title={t("topItems")}>
        <ul className="flex flex-col gap-2.5">
          {data.topItems.slice(0, 6).map((it, i) => (
            <li key={it.nameEn} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">
                  <span className="tabular me-1.5 text-smoke-400">{i + 1}.</span>
                  {L(it.nameAr, it.nameEn)}
                </span>
                <span className="tabular shrink-0 text-xs text-smoke-300">
                  {it.qty} · {formatMoney(it.revenuePiasters, locale)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-coal-700">
                <div className="h-full rounded-full bg-gradient-to-r from-ember-500 to-flame-400" style={{ width: `${(it.qty / (data.topItems[0]?.qty || 1)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </ChartCard>

      <ChartCard title={t("byHour")} className="xl:col-span-2">
        <div className="h-56" dir="ltr">
          <ResponsiveContainer>
            <BarChart data={hours} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} reversed={rtl} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={28} orientation={rtl ? "right" : "left"} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(255,138,69,0.08)" }} />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                {hours.map((h, i) => (
                  <Cell key={i} fill={h.orders === Math.max(...hours.map((x) => x.orders)) && h.orders > 0 ? "#ffc65c" : EMBER} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="flex flex-col gap-4">
        <ChartCard title={t("byArea")}>
          <ul className="flex flex-col gap-2">
            {data.byArea.map((a, i) => (
              <li key={a.nameEn} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">{L(a.nameAr, a.nameEn)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-coal-700">
                  <div className="h-full rounded-full" style={{ width: `${(a.orders / maxArea) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                </div>
                <span className="tabular w-6 text-end text-xs text-smoke-300">{a.orders}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title={t("byPayment")}>
          <div className="mb-3 flex h-3 overflow-hidden rounded-full">
            {data.byPayment.map((p, i) => (
              <div key={p.method} style={{ width: `${(p.orders / totalPay) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-1.5 text-xs">
            {data.byPayment.map((p, i) => (
              <li key={p.method} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                {tp(p.method as "cash")} <span className="tabular text-smoke-400">{p.orders}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}

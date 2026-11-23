"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { saveHoursAction, savePromoAction, saveSettingAction, saveZonesAction, toggleOfferAction } from "@/server/actions/admin";
import type { InstapaySettings, OpeningHour, OrderingSettings, PaymentToggles, VatSettings } from "@/types/catalog";

function Panel({ id, title, children, onSave, pending }: { id: string; title: string; children: ReactNode; onSave?: () => void; pending?: boolean }) {
  const t = useTranslations("common");
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="font-sans text-lg font-semibold">
          {title}
        </h2>
        {onSave && (
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {t("save")}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function useSaver() {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else toast.error(`${t("error")} (${r.error})`);
    });
  return { pending, run };
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-coal-850 px-3 py-2.5 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function GeneralSettings({
  ordering,
  vat,
  payments,
  instapay,
  alertPhone,
}: {
  ordering: OrderingSettings;
  vat: VatSettings;
  payments: PaymentToggles;
  instapay: InstapaySettings;
  alertPhone: string;
}) {
  const t = useTranslations("admin.settings");
  const tp = useTranslations("payment");
  const { pending, run } = useSaver();
  const [o, setO] = useState(ordering);
  const [v, setV] = useState({ rate: String(vat.rateBps / 100), inclusive: vat.pricesIncludeVat });
  const [p, setP] = useState(payments);
  const [ip, setIp] = useState(instapay);
  const [phone, setPhone] = useState(alertPhone);

  const saveAll = () =>
    run(async () => {
      for (const [key, value] of [
        ["ordering", o],
        ["vat", { rateBps: Math.round(Number(v.rate) * 100), pricesIncludeVat: v.inclusive }],
        ["payments", p],
        ["instapay", ip],
        ["notifications", { restaurantAlertPhone: phone }],
      ] as const) {
        const r = await saveSettingAction({ key, value });
        if (!r.ok) return r;
      }
      return { ok: true };
    });

  return (
    <Panel id="ordering" title={`${t("ordering")} · ${t("vat")} · ${t("payments")}`} onSave={saveAll} pending={pending}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2.5">
          <Toggle label={t("acceptingOrders")} checked={o.acceptingOrders} onChange={(x) => setO({ ...o, acceptingOrders: x })} />
          <Toggle label={t("allowScheduledWhenClosed")} checked={o.allowScheduledWhenClosed} onChange={(x) => setO({ ...o, allowScheduledWhenClosed: x })} />
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("minLead")} htmlFor="lead">
              <Input id="lead" inputMode="numeric" dir="ltr" value={o.minScheduleLeadMinutes} onChange={(e) => setO({ ...o, minScheduleLeadMinutes: Number(e.target.value) || 0 })} />
            </Field>
            <Field label={t("maxDays")} htmlFor="maxd">
              <Input id="maxd" inputMode="numeric" dir="ltr" value={o.maxScheduleDays} onChange={(e) => setO({ ...o, maxScheduleDays: Number(e.target.value) || 0 })} />
            </Field>
            <Field label={t("pickupEta")} htmlFor="peta">
              <Input id="peta" inputMode="numeric" dir="ltr" value={o.pickupEtaMinutes} onChange={(e) => setO({ ...o, pickupEtaMinutes: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Field label={t("vatRate")} htmlFor="vat">
            <Input id="vat" inputMode="decimal" dir="ltr" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} />
          </Field>
          <Toggle label={t("pricesIncludeVat")} checked={v.inclusive} onChange={(x) => setV({ ...v, inclusive: x })} />
          <Field label={t("alertPhone")} htmlFor="alert">
            <Input id="alert" type="tel" dir="ltr" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-2.5">
          {(Object.keys(p) as (keyof PaymentToggles)[]).map((k) => (
            <Toggle key={k} label={tp(k)} checked={p[k]} onChange={(x) => setP({ ...p, [k]: x })} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("instapayHandle")} htmlFor="iph">
              <Input id="iph" dir="ltr" value={ip.handle} onChange={(e) => setIp({ ...ip, handle: e.target.value })} />
            </Field>
            <Field label={t("instapayName")} htmlFor="ipn">
              <Input id="ipn" dir="ltr" value={ip.accountName} onChange={(e) => setIp({ ...ip, accountName: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function HoursSettings({ hours }: { hours: OpeningHour[] }) {
  const t = useTranslations("admin.settings");
  const days = t.raw("days") as string[];
  const { pending, run } = useSaver();
  const [rows, setRows] = useState(hours);
  const update = (d: number, patch: Partial<OpeningHour>) => setRows((all) => all.map((r) => (r.dayOfWeek === d ? { ...r, ...patch } : r)));
  return (
    <Panel id="hours" title={t("hours")} onSave={() => run(() => saveHoursAction(rows))} pending={pending}>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.dayOfWeek} className="flex items-center gap-3 rounded-lg border border-border bg-coal-850 px-3 py-2 text-sm">
            <span className="w-20 font-medium">{days[r.dayOfWeek]}</span>
            <input type="time" aria-label={`${days[r.dayOfWeek]} ${t("opens")}`} value={r.opensAt} disabled={r.isClosed} onChange={(e) => update(r.dayOfWeek, { opensAt: e.target.value })} className="h-9 rounded-md border border-border-strong bg-coal-900 px-2 [color-scheme:dark]" dir="ltr" />
            <span className="text-smoke-400">→</span>
            <input type="time" aria-label={`${days[r.dayOfWeek]} ${t("closes")}`} value={r.closesAt} disabled={r.isClosed} onChange={(e) => update(r.dayOfWeek, { closesAt: e.target.value })} className="h-9 rounded-md border border-border-strong bg-coal-900 px-2 [color-scheme:dark]" dir="ltr" />
            <label className="ms-auto flex items-center gap-2 text-xs text-smoke-300">
              {t("closed")}
              <Switch checked={r.isClosed} onCheckedChange={(x) => update(r.dayOfWeek, { isClosed: x })} />
            </label>
          </div>
        ))}
      </div>
    </Panel>
  );
}

interface ZoneRow {
  id?: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  fee: string;
  minOrder: string;
  etaMin: string;
  etaMax: string;
  isActive: boolean;
}

export function ZonesSettings({ zones }: { zones: ZoneRow[] }) {
  const t = useTranslations("admin.settings");
  const { pending, run } = useSaver();
  const [rows, setRows] = useState(zones);
  const set = (i: number, patch: Partial<ZoneRow>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cell = "h-9 w-full rounded-md border border-border-strong bg-coal-900 px-2 text-sm";
  return (
    <Panel id="zones" title={t("zones")} onSave={() => run(() => saveZonesAction(rows))} pending={pending}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-xs text-smoke-400">
            <tr className="text-start">
              <th className="p-1 text-start font-medium">AR</th>
              <th className="p-1 text-start font-medium">EN</th>
              <th className="p-1 text-start font-medium">{t("fee")}</th>
              <th className="p-1 text-start font-medium">{t("minOrder")}</th>
              <th className="p-1 text-start font-medium">{t("etaMin")}</th>
              <th className="p-1 text-start font-medium">{t("etaMax")}</th>
              <th className="p-1 text-start font-medium">{t("active")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((z, i) => (
              <tr key={z.id ?? `new-${i}`}>
                <td className="p-1"><input className={cell} value={z.nameAr} onChange={(e) => set(i, { nameAr: e.target.value })} aria-label="name ar" /></td>
                <td className="p-1"><input className={cell} dir="ltr" value={z.nameEn} onChange={(e) => set(i, { nameEn: e.target.value, slug: z.id ? z.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} aria-label="name en" /></td>
                <td className="p-1"><input className={cell} dir="ltr" inputMode="decimal" value={z.fee} onChange={(e) => set(i, { fee: e.target.value })} aria-label={t("fee")} /></td>
                <td className="p-1"><input className={cell} dir="ltr" inputMode="decimal" value={z.minOrder} onChange={(e) => set(i, { minOrder: e.target.value })} aria-label={t("minOrder")} /></td>
                <td className="p-1"><input className={cell} dir="ltr" inputMode="numeric" value={z.etaMin} onChange={(e) => set(i, { etaMin: e.target.value })} aria-label={t("etaMin")} /></td>
                <td className="p-1"><input className={cell} dir="ltr" inputMode="numeric" value={z.etaMax} onChange={(e) => set(i, { etaMax: e.target.value })} aria-label={t("etaMax")} /></td>
                <td className="p-1"><Switch checked={z.isActive} onCheckedChange={(x) => set(i, { isActive: x })} aria-label={t("active")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setRows((r) => [...r, { slug: "", nameAr: "", nameEn: "", fee: "30", minOrder: "200", etaMin: "40", etaMax: "55", isActive: true }])}>
        <Plus aria-hidden />
        {t("addZone")}
      </Button>
    </Panel>
  );
}

interface PromoRow {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxDiscountPiasters: number | null;
  minSubtotalPiasters: number;
  perPhoneLimit: number | null;
  timesUsed: number;
  usageLimit: number | null;
  endsAt: string | null;
  isActive: boolean;
}

export function PromoSettings({ promos }: { promos: PromoRow[] }) {
  const t = useTranslations("admin.settings");
  const locale = useLocale() as "ar" | "en";
  const { pending, run } = useSaver();
  const [form, setForm] = useState({ code: "", discountType: "percent" as "percent" | "fixed", value: "", minSubtotal: "0", maxDiscount: "", perPhoneLimit: "" });
  return (
    <Panel id="promos" title={t("promos")}>
      <ul className="mb-4 flex flex-col divide-y divide-border">
        {promos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <span className="rounded-md border border-dashed border-ember-400/50 px-2 py-0.5 font-mono font-semibold text-ember-300">{p.code}</span>
            <span>{p.discountType === "percent" ? `${p.discountValue}%` : formatMoney(p.discountValue, locale)}</span>
            {p.minSubtotalPiasters > 0 && <span className="text-xs text-smoke-400">{t("minSubtotal")} {formatMoney(p.minSubtotalPiasters, locale)}</span>}
            {p.perPhoneLimit && <span className="text-xs text-smoke-400">{t("perPhone")}: {p.perPhoneLimit}</span>}
            <span className="text-xs text-smoke-400">{t("usage")}: {p.timesUsed}{p.usageLimit ? ` / ${p.usageLimit}` : ""}</span>
            <span className="ms-auto flex items-center gap-2">
              <Badge variant={p.isActive ? "zaatar" : "default"}>{p.isActive ? t("active") : "—"}</Badge>
              <Switch
                checked={p.isActive}
                aria-label={`${t("active")}: ${p.code}`}
                onCheckedChange={(on) =>
                  run(() =>
                    savePromoAction({
                      id: p.id,
                      code: p.code,
                      discountType: p.discountType,
                      value: p.discountType === "percent" ? p.discountValue : p.discountValue / 100,
                      maxDiscount: p.maxDiscountPiasters ? p.maxDiscountPiasters / 100 : undefined,
                      minSubtotal: p.minSubtotalPiasters / 100,
                      perPhoneLimit: p.perPhoneLimit ?? undefined,
                      endsAt: p.endsAt ?? "",
                      isActive: on,
                    }),
                  )
                }
              />
            </span>
          </li>
        ))}
      </ul>
      <form
        className="grid items-end gap-2 sm:grid-cols-3 lg:grid-cols-7"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            savePromoAction({
              code: form.code,
              discountType: form.discountType,
              value: form.value,
              minSubtotal: form.minSubtotal || 0,
              maxDiscount: form.maxDiscount || undefined,
              perPhoneLimit: form.perPhoneLimit || undefined,
              isActive: true,
            }),
          );
        }}
      >
        <Field label={t("code")} htmlFor="pc">
          <Input id="pc" dir="ltr" className="uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
        </Field>
        <Field label={t("type")} htmlFor="pt">
          <NativeSelect id="pt" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" | "fixed" })}>
            <option value="percent">{t("percent")}</option>
            <option value="fixed">{t("fixed")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("value")} htmlFor="pv">
          <Input id="pv" dir="ltr" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
        </Field>
        <Field label={t("minSubtotal")} htmlFor="pm">
          <Input id="pm" dir="ltr" inputMode="decimal" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
        </Field>
        <Field label={t("maxDiscount")} htmlFor="px">
          <Input id="px" dir="ltr" inputMode="decimal" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
        </Field>
        <Field label={t("perPhone")} htmlFor="pp">
          <Input id="pp" dir="ltr" inputMode="numeric" value={form.perPhoneLimit} onChange={(e) => setForm({ ...form, perPhoneLimit: e.target.value })} />
        </Field>
        <Button type="submit" disabled={pending} className="h-12">
          <Plus aria-hidden />
          {t("addPromo")}
        </Button>
      </form>
    </Panel>
  );
}

export function OfferSettings({ offers }: { offers: { id: string; title: string; isActive: boolean }[] }) {
  const t = useTranslations("admin.settings");
  const { run } = useSaver();
  return (
    <Panel id="offers" title={t("offers")}>
      <ul className="flex flex-col gap-2">
        {offers.map((o) => (
          <li key={o.id}>
            <Toggle label={o.title} checked={o.isActive} onChange={(on) => run(() => toggleOfferAction({ id: o.id, active: on }))} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

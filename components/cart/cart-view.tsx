"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Bike, Loader2, ShoppingBag, Store, Tag, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FoodImage } from "@/components/brand/food-image";
import { Price } from "@/components/brand/price";
import { EmptyState } from "@/components/common/empty-state";
import { useCartView, useCatalog } from "@/components/providers/catalog-provider";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/controls";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart-store";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { validatePromoAction } from "@/server/actions/promo";

export function CartView() {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("cart");
  const ti = useTranslations("item");
  const tm = useTranslations("menu");
  const { zones, settings } = useCatalog();
  const view = useCartView();
  const { setQuantity, remove, setFulfillment, setZone, setPromo, clear } = useCart();
  const fulfillment = useCart((s) => s.fulfillment);
  const promo = useCart((s) => s.promo);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const L = (ar: string | null, en: string | null) => (locale === "ar" ? ar : en) ?? "";
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const p = view.pricing;

  if (!view.hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]" aria-busy="true">
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (view.lines.length === 0) {
    return (
      <EmptyState
        className="py-20"
        icon={<ShoppingBag aria-hidden />}
        title={t("empty")}
        description={t("emptyHint")}
        action={
          <Button size="lg" asChild>
            <Link href="/menu">
              {tm("title")}
              <Arrow aria-hidden />
            </Link>
          </Button>
        }
      />
    );
  }

  const belowMin = p.errors.find((e) => e.code === "BELOW_MIN_ORDER");
  const needsZone = fulfillment === "delivery" && !view.zone;
  const unavailable = p.errors.filter((e) => e.code === "ITEM_UNAVAILABLE").map((e) => e.lineIndex);
  const canCheckout = !needsZone && !belowMin && unavailable.length === 0 && p.lines.length > 0;

  const applyPromo = () => {
    const value = code.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await validatePromoAction({ code: value, subtotal: p.subtotalPiasters });
      if (res.ok) {
        setPromo(res.rule);
        setCode("");
        toast.success(t("promoApplied", { code: res.rule.code }));
      } else {
        toast.error(t(`promoErrors.${res.error}`, { amount: res.min !== undefined ? formatMoney(res.min, locale) : "" }));
      }
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
      {/* Lines */}
      <section aria-label={t("title")} className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {view.lines.map((line, idx) => {
            const priced = p.lines[idx];
            const item = line.item;
            const isUnavailable = unavailable.includes(idx);
            return (
              <li
                key={line.key}
                className={cn(
                  "flex gap-3.5 rounded-2xl border border-border bg-card p-3 shadow-card",
                  isUnavailable && "border-chili-400/40",
                )}
              >
                <Link href={`/menu/${item.slug}`} className="shrink-0">
                  <FoodImage src={item.imageUrl} alt="" category={item.categorySlug} sizes="96px" className="size-22 rounded-xl sm:size-24" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/menu/${item.slug}`} className="font-semibold leading-snug hover:text-ember-300">
                      {L(item.nameAr, item.nameEn)}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(line.key)}
                      aria-label={`${t("remove")}: ${L(item.nameAr, item.nameEn)}`}
                      className="-me-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-smoke-400 transition-colors hover:bg-coal-700 hover:text-chili-400"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  {Boolean(priced?.sizeNameAr || priced?.addons.length) && (
                    <p className="text-xs leading-relaxed text-smoke-300">
                      {[priced?.sizeNameAr ? L(priced.sizeNameAr, priced.sizeNameEn) : null, ...(priced?.addons ?? []).map((a) => L(a.nameAr, a.nameEn))]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {line.notes && <p className="text-xs italic text-smoke-400">“{line.notes}”</p>}
                  {isUnavailable && <p className="text-xs font-semibold text-chili-400">{ti("soldOutHint")}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <QuantityStepper
                      size="sm"
                      value={line.quantity}
                      min={0}
                      onChange={(q) => setQuantity(line.key, q)}
                      labels={{ decrease: ti("decrease"), increase: ti("increase"), quantity: ti("quantity") }}
                    />
                    {priced && <Price piasters={priced.lineTotalPiasters} locale={locale} className="text-cream-50" />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between pt-1">
          <Button variant="link" asChild>
            <Link href="/menu">{t("continueShopping")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} className="text-smoke-300">
            <Trash2 aria-hidden />
            {t("clear")}
          </Button>
        </div>
      </section>

      {/* Summary */}
      <aside aria-label={t("summary")} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-24">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">{t("deliveryOrPickup")}</legend>
          <div className="grid grid-cols-2 gap-2 rounded-full border border-border-strong bg-coal-850 p-1" role="radiogroup">
            {(
              [
                ["delivery", t("deliveryOption"), Bike],
                ["pickup", t("pickupOption"), Store],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={fulfillment === value}
                onClick={() => setFulfillment(value)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
                  fulfillment === value ? "bg-ember-400 text-coal-950" : "text-smoke-200 hover:text-cream-50",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          {fulfillment === "delivery" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="cart-zone" className="text-sm text-smoke-300">
                {t("deliverTo")}
              </label>
              <NativeSelect id="cart-zone" value={view.zone?.id ?? ""} onChange={(e) => setZone(e.target.value || null)}>
                <option value="" disabled>
                  {t("chooseArea")}
                </option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {L(z.nameAr, z.nameEn)} — {formatMoney(z.feePiasters, locale)}
                  </option>
                ))}
              </NativeSelect>
              {belowMin && view.zone && (
                <div className="rounded-xl border border-flame-400/30 bg-flame-400/10 p-3 text-sm text-flame-300">
                  {t("belowMin", {
                    amount: formatMoney(view.zone.minOrderPiasters - p.subtotalPiasters, locale),
                    zone: L(view.zone.nameAr, view.zone.nameEn),
                  })}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-coal-700">
                    <div
                      className="h-full rounded-full bg-flame-400"
                      style={{ width: `${Math.min(100, (p.subtotalPiasters / view.zone.minOrderPiasters) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-smoke-300">{t("pickupHint", { min: settings.ordering.pickupEtaMinutes })}</p>
          )}
        </fieldset>

        <div className="hairline" />

        {promo ? (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-zaatar-400/50 bg-zaatar-900/50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-zaatar-300">
              <Tag className="size-4" aria-hidden />
              {promo.code}
            </span>
            <button
              type="button"
              onClick={() => setPromo(null)}
              aria-label={t("removePromo")}
              className="grid size-7 place-items-center rounded-full text-smoke-300 hover:bg-coal-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyPromo();
            }}
          >
            <label htmlFor="promo" className="sr-only">
              {t("promo")}
            </label>
            <Input
              id="promo"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("promoPlaceholder")}
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={24}
              className="h-11 uppercase placeholder:normal-case"
            />
            <Button type="submit" variant="secondary" className="h-11 shrink-0" disabled={pending || !code.trim()}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : t("applyPromo")}
            </Button>
          </form>
        )}

        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-smoke-300">{t("subtotal")}</dt>
            <dd>
              <Price piasters={p.subtotalPiasters} locale={locale} />
            </dd>
          </div>
          {p.discountPiasters > 0 && (
            <div className="flex justify-between text-zaatar-300">
              <dt>
                {t("discount")} · {p.promo?.code}
              </dt>
              <dd>
                −<Price piasters={p.discountPiasters} locale={locale} />
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-smoke-300">{t("delivery")}</dt>
            <dd>
              {fulfillment === "pickup" ? (
                <span className="font-semibold text-zaatar-300">{t("free")}</span>
              ) : view.zone ? (
                <Price piasters={p.deliveryFeePiasters} locale={locale} />
              ) : (
                <span className="text-xs text-smoke-400">{t("chooseAreaForFee")}</span>
              )}
            </dd>
          </div>
          {!p.pricesIncludeVat && (
            <div className="flex justify-between">
              <dt className="text-smoke-300">{t("vat", { rate: p.vatRateBps / 100 })}</dt>
              <dd>
                <Price piasters={p.vatPiasters} locale={locale} />
              </dd>
            </div>
          )}
          <div className="hairline my-1" />
          <div className="flex items-center justify-between">
            <dt className="text-base font-semibold">{t("total")}</dt>
            <dd>
              <Price piasters={p.totalPiasters} locale={locale} className="text-2xl text-cream-50" />
            </dd>
          </div>
          {p.pricesIncludeVat && (
            <p className="text-xs text-smoke-400">
              {t("vatIncluded", { rate: p.vatRateBps / 100 })} · <Price piasters={p.vatPiasters} locale={locale} className="font-normal" />
            </p>
          )}
        </dl>

        <Button size="lg" asChild={canCheckout} disabled={!canCheckout} className="w-full justify-between">
          {canCheckout ? (
            <Link href="/checkout">
              <span>{t("checkout")}</span>
              <Price piasters={p.totalPiasters} locale={locale} />
            </Link>
          ) : (
            <span>{needsZone ? t("chooseAreaForFee") : t("checkout")}</span>
          )}
        </Button>
      </aside>
    </div>
  );
}

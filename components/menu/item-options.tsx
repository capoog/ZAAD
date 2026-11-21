"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Price } from "@/components/brand/price";
import { Button } from "@/components/ui/button";
import { Checkbox, QuantityStepper, RadioCard, RadioGroup } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart-store";
import { priceLine } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/catalog";

export function ItemOptions({ item }: { item: MenuItem }) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("item");
  const tc = useTranslations("common");
  const tm = useTranslations("menu");
  const router = useRouter();
  const add = useCart((s) => s.add);
  const L = (ar: string, en: string) => (locale === "ar" ? ar : en);

  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0];
  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [attempted, setAttempted] = useState(false);

  const priced = useMemo(
    () => priceLine({ menuItemId: item.id, sizeId, addonIds, quantity: qty, notes }, item, 0),
    [item, sizeId, addonIds, qty, notes],
  );
  const blocking = priced.errors.filter((e) => e.code !== "BAD_QUANTITY");
  const groupError = (groupId: string) =>
    attempted && blocking.some((e) => (e.code === "ADDON_GROUP_MIN" || e.code === "ADDON_GROUP_MAX") && e.meta?.group === groupId);

  const toggleAddon = (groupId: string, addonId: string, on: boolean) => {
    const group = item.addonGroups.find((g) => g.id === groupId);
    if (!group) return;
    const inGroup = new Set(group.addons.map((a) => a.id));
    setAddonIds((cur) => {
      if (!on) return cur.filter((x) => x !== addonId);
      // Single-choice groups behave like radios.
      if (group.maxSelect === 1) return [...cur.filter((x) => !inGroup.has(x)), addonId];
      const count = cur.filter((x) => inGroup.has(x)).length;
      if (group.maxSelect !== null && count >= group.maxSelect) return cur;
      return [...cur, addonId];
    });
  };

  const submit = () => {
    setAttempted(true);
    if (item.isSoldOut || blocking.length > 0) return;
    add({ menuItemId: item.id, slug: item.slug, sizeId, addonIds, quantity: qty, notes: notes.trim() });
    toast.success(tm("addedToast", { name: L(item.nameAr, item.nameEn) }), {
      action: { label: tm("viewCartAction"), onClick: () => router.push("/cart") },
    });
    router.push("/menu");
  };

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {item.sizes.length > 0 && (
        <fieldset className="flex flex-col">
          <legend className="mb-3 flex w-full items-center justify-between text-base font-semibold">
            {t("size")}
            <span className="rounded-full bg-ember-900/70 px-2 py-0.5 text-xs text-ember-300">{t("required")}</span>
          </legend>
          <RadioGroup value={sizeId ?? undefined} onValueChange={setSizeId} className="flex flex-col gap-2.5">
            {item.sizes.map((s) => (
              <RadioCard key={s.id} value={s.id}>
                <span className="flex-1 font-medium">{L(s.nameAr, s.nameEn)}</span>
                <Price piasters={s.pricePiasters} locale={locale} className="text-cream-50" />
              </RadioCard>
            ))}
          </RadioGroup>
        </fieldset>
      )}

      {item.addonGroups.map((g) => (
        <fieldset key={g.id} className="flex flex-col gap-2" aria-invalid={groupError(g.id) || undefined}>
          <legend className="mb-3 flex w-full items-center justify-between text-base font-semibold">
            {L(g.nameAr, g.nameEn)}
            <span className={cn("text-xs font-normal", g.minSelect > 0 ? "text-ember-300" : "text-smoke-300")}>
              {g.minSelect > 0 ? t("required") : g.maxSelect && g.maxSelect > 1 ? t("chooseUpTo", { max: g.maxSelect }) : t("optional")}
            </span>
          </legend>
          {g.addons.map((a) => {
            const on = addonIds.includes(a.id);
            return (
              <label
                key={a.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-coal-850 px-4 py-3.5 transition-colors hover:border-border-strong has-[[data-state=checked]]:border-ember-400/60 has-[[data-state=checked]]:bg-ember-900/20",
                  !a.isAvailable && "cursor-not-allowed opacity-50",
                )}
              >
                <Checkbox checked={on} disabled={!a.isAvailable} onCheckedChange={(v) => toggleAddon(g.id, a.id, v === true)} />
                <span className="flex-1">{L(a.nameAr, a.nameEn)}</span>
                {a.pricePiasters === 0 ? (
                  <span className="text-sm font-semibold text-zaatar-300">{tc("free")}</span>
                ) : (
                  <span className="text-sm text-smoke-300">
                    + <Price piasters={a.pricePiasters} locale={locale} />
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
      ))}

      <div className="flex flex-col gap-2">
        <label htmlFor="item-notes" className="text-base font-semibold">
          {t("notes")} <span className="text-xs font-normal text-smoke-300">({t("optional")})</span>
        </label>
        <Textarea
          id="item-notes"
          maxLength={200}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          className="min-h-20"
        />
      </div>

      {/* Sticky action bar (bottom of screen on mobile, inline on desktop) */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-coal-900/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-xl items-center gap-3 md:max-w-none">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            labels={{ decrease: t("decrease"), increase: t("increase"), quantity: t("quantity") }}
          />
          <Button type="submit" size="lg" className="flex-1 justify-between px-6" disabled={item.isSoldOut}>
            <span>{item.isSoldOut ? tc("soldOut") : tc("addToCart")}</span>
            {priced.line && !item.isSoldOut && <Price piasters={priced.line.lineTotalPiasters} locale={locale} />}
          </Button>
        </div>
      </div>
    </form>
  );
}

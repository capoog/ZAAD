"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRing, ShoppingBag } from "lucide-react";
import { Price } from "@/components/brand/price";
import { Button } from "@/components/ui/button";
import { Checkbox, QuantityStepper, RadioCard, RadioGroup, Switch } from "@/components/ui/controls";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CategoryChips, type ChipItem } from "@/components/menu/category-chips";
import { isValidEgyptianMobile } from "@/lib/phone";
import type { AppLocale } from "@/lib/money";

export function ChipsDemo({ items, label }: { items: ChipItem[]; label: string }) {
  return <CategoryChips items={items} ariaLabel={label} />;
}

export function ToastDemo() {
  const t = useTranslations("styleGuide");
  return (
    <Button
      variant="secondary"
      onClick={() =>
        toast.success(t("toastTitle"), {
          description: t("toastBody"),
          icon: <ShoppingBag className="size-4" />,
        })
      }
    >
      <BellRing aria-hidden />
      {t("toast")}
    </Button>
  );
}

export function FormsDemo({
  locale,
  zones,
  sizes,
  addons,
}: {
  locale: AppLocale;
  zones: { slug: string; name: string; fee: number }[];
  sizes: { id: string; name: string; price: number }[];
  addons: { id: string; name: string; price: number }[];
}) {
  const t = useTranslations("styleGuide");
  const ti = useTranslations("item");
  const tc = useTranslations("common");
  const [phone, setPhone] = useState("0109123");
  const [size, setSize] = useState(sizes[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([addons[0]?.id ?? ""]);
  const [qty, setQty] = useState(2);
  const [spicy, setSpicy] = useState(true);
  const phoneInvalid = phone.length > 0 && !isValidEgyptianMobile(phone);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Field
          label={t("phoneLabel")}
          htmlFor="sg-phone"
          hint={t("phoneHint")}
          error={phoneInvalid ? t("phoneError") : undefined}
        >
          <Input
            id="sg-phone"
            inputMode="tel"
            autoComplete="tel-national"
            dir="ltr"
            className="text-start"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={phoneInvalid}
            aria-describedby={phoneInvalid ? "sg-phone-error" : "sg-phone-hint"}
            placeholder="01X XXXX XXXX"
          />
        </Field>
        <Field label={t("areaLabel")} htmlFor="sg-area">
          <NativeSelect id="sg-area" defaultValue={zones[0]?.slug}>
            {zones.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("landmarkLabel")} htmlFor="sg-landmark">
          <Input id="sg-landmark" placeholder={t("landmarkPlaceholder")} />
        </Field>
        <Field label={ti("notes")} htmlFor="sg-notes">
          <Textarea id="sg-notes" placeholder={ti("notesPlaceholder")} />
        </Field>
      </div>

      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 flex w-full items-center justify-between text-sm font-semibold">
            {ti("size")}
            <span className="rounded-full bg-ember-900/70 px-2 py-0.5 text-xs text-ember-300">{ti("required")}</span>
          </legend>
          <RadioGroup value={size} onValueChange={setSize} className="flex flex-col gap-2.5">
            {sizes.map((s) => (
              <RadioCard key={s.id} value={s.id}>
                <span className="flex-1 font-medium">{s.name}</span>
                <Price piasters={s.price} locale={locale} className="text-cream-50" />
              </RadioCard>
            ))}
          </RadioGroup>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-3 flex w-full items-center justify-between text-sm font-semibold">
            {ti("addons")}
            <span className="text-xs font-normal text-smoke-300">{ti("optional")}</span>
          </legend>
          {addons.map((a) => {
            const on = picked.includes(a.id);
            return (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-coal-850 px-4 py-3 transition-colors hover:border-border-strong has-[[data-state=checked]]:border-ember-400/60"
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => setPicked((p) => (v ? [...p, a.id] : p.filter((x) => x !== a.id)))}
                />
                <span className="flex-1">{a.name}</span>
                {a.price === 0 ? (
                  <span className="text-sm font-semibold text-zaatar-300">{tc("free")}</span>
                ) : (
                  <span className="text-sm text-smoke-300">
                    + <Price piasters={a.price} locale={locale} />
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>

        <div className="flex items-center justify-between rounded-lg border border-border bg-coal-850 px-4 py-3">
          <label htmlFor="sg-spicy" className="font-medium">
            {t("spicyToggle")}
          </label>
          <Switch id="sg-spicy" checked={spicy} onCheckedChange={setSpicy} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            labels={{ decrease: "−", increase: "+", quantity: ti("quantity") }}
          />
          <Button size="lg" className="flex-1">
            {tc("addToCart")}
            <span className="h-5 w-px bg-coal-950/25" aria-hidden />
            <Price
              piasters={
                ((sizes.find((s) => s.id === size)?.price ?? 0) +
                  addons.filter((a) => picked.includes(a.id)).reduce((s, a) => s + a.price, 0)) *
                qty
              }
              locale={locale}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

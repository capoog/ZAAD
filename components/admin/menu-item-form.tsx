"use client";

import { useState, useTransition } from "react";
import { ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FoodImage } from "@/components/brand/food-image";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/controls";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { saveMenuItemAction, setItemActiveAction } from "@/server/actions/admin";
import type { MenuItem } from "@/types/catalog";

interface Props {
  item: MenuItem | null;
  categories: { id: string; slug: string; nameAr: string; nameEn: string }[];
  groups: { id: string; nameAr: string; nameEn: string; addons: string }[];
}

export function MenuItemForm({ item, categories, groups }: Props) {
  const t = useTranslations("admin.menu");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const L = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const [v, setV] = useState({
    categoryId: item?.categoryId ?? categories[0]?.id ?? "",
    slug: item?.slug ?? "",
    nameAr: item?.nameAr ?? "",
    nameEn: item?.nameEn ?? "",
    descriptionAr: item?.descriptionAr ?? "",
    descriptionEn: item?.descriptionEn ?? "",
    price: item ? String(item.basePricePiasters / 100) : "",
    isSpicy: item?.isSpicy ?? false,
    isVegetarian: item?.isVegetarian ?? false,
    isBestSeller: item?.isBestSeller ?? false,
    isFeatured: item?.isFeatured ?? false,
  });
  const [sizes, setSizes] = useState(item?.sizes.map((s) => ({ nameAr: s.nameAr, nameEn: s.nameEn, price: String(s.pricePiasters / 100) })) ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(item?.addonGroups.map((g) => g.id) ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(item?.imageUrl ?? null);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const category = categories.find((c) => c.id === v.categoryId);

  const submit = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ ...v, id: item?.id ?? "", sizes, addonGroupIds: groupIds }));
      if (file) fd.set("image", file);
      const r = await saveMenuItemAction(fd);
      if (!r.ok) return void toast.error(t(`errors.${["SLUG_TAKEN", "FORBIDDEN", "IMAGE"].includes(r.error) ? r.error : "VALIDATION"}` as "errors.VALIDATION"));
      toast.success(t("saved"));
      router.push("/admin/menu");
      router.refresh();
    });

  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("nameAr")} htmlFor="nameAr">
            <Input id="nameAr" dir="rtl" value={v.nameAr} onChange={(e) => set("nameAr", e.target.value)} required maxLength={80} />
          </Field>
          <Field label={t("nameEn")} htmlFor="nameEn">
            <Input id="nameEn" dir="ltr" value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} required maxLength={80} />
          </Field>
          <Field label={t("descAr")} htmlFor="descAr">
            <Textarea id="descAr" dir="rtl" value={v.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} maxLength={500} />
          </Field>
          <Field label={t("descEn")} htmlFor="descEn">
            <Textarea id="descEn" dir="ltr" value={v.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} maxLength={500} />
          </Field>
          <Field label={t("category")} htmlFor="category">
            <NativeSelect id="category" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {L(c.nameAr, c.nameEn)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("slug")} htmlFor="slug">
            <Input id="slug" dir="ltr" className="font-mono text-start" value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} required pattern="[a-z0-9-]{2,80}" />
          </Field>
          {sizes.length === 0 && (
            <Field label={t("price")} htmlFor="price">
              <Input id="price" dir="ltr" inputMode="decimal" className="tabular text-start" value={v.price} onChange={(e) => set("price", e.target.value)} required />
            </Field>
          )}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 flex w-full items-center justify-between font-semibold">
            {t("sizes")}
            <Button type="button" size="sm" variant="secondary" onClick={() => setSizes((s) => [...s, { nameAr: "", nameEn: "", price: "" }])}>
              <Plus aria-hidden />
              {t("addSize")}
            </Button>
          </legend>
          {sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_7rem_auto] items-end gap-2">
              <Field label={t("sizeNameAr")} htmlFor={`sa-${i}`}>
                <Input id={`sa-${i}`} value={s.nameAr} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, nameAr: e.target.value } : x)))} required />
              </Field>
              <Field label={t("sizeNameEn")} htmlFor={`se-${i}`}>
                <Input id={`se-${i}`} dir="ltr" value={s.nameEn} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, nameEn: e.target.value } : x)))} required />
              </Field>
              <Field label={t("price")} htmlFor={`sp-${i}`}>
                <Input id={`sp-${i}`} dir="ltr" inputMode="decimal" className="tabular" value={s.price} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} required />
              </Field>
              <Button type="button" size="icon" variant="danger" aria-label="remove" onClick={() => setSizes((all) => all.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">{t("addonGroups")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <label key={g.id} className="flex items-start gap-3 rounded-lg border border-border bg-coal-850 p-3 text-sm">
                <Checkbox checked={groupIds.includes(g.id)} onCheckedChange={(on) => setGroupIds((cur) => (on ? [...cur, g.id] : cur.filter((x) => x !== g.id)))} />
                <span>
                  <span className="font-medium">{L(g.nameAr, g.nameEn)}</span>
                  <span className="block text-xs text-smoke-400">{g.addons}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <span className="font-semibold">{t("image")}</span>
          {preview?.startsWith("blob:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
          ) : (
            <FoodImage src={preview} alt="" category={category?.slug} sizes="22rem" className="aspect-[4/3] rounded-xl" />
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-3 text-sm hover:border-ember-400/60">
            <ImageUp className="size-4 text-ember-400" aria-hidden />
            {t("uploadImage")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setPreview(URL.createObjectURL(f));
              }}
            />
          </label>
          <p className="text-xs text-smoke-400">{t("imageHint")}</p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <span className="font-semibold">{t("flags")}</span>
          {(
            [
              ["isSpicy", t("spicy")],
              ["isVegetarian", t("vegetarian")],
              ["isBestSeller", t("bestSeller")],
              ["isFeatured", t("featured")],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between text-sm">
              {label}
              <Switch checked={v[k]} onCheckedChange={(on) => set(k, on)} />
            </label>
          ))}
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("save")}
        </Button>
        {item && (
          <Button
            type="button"
            variant={item.isActive ? "danger" : "zaatar"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setItemActiveAction({ itemId: item.id, active: !item.isActive });
                router.refresh();
              })
            }
          >
            {item.isActive ? t("delete") : t("restore")}
          </Button>
        )}
      </aside>
    </form>
  );
}

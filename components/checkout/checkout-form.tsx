"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Banknote,
  Bike,
  CalendarClock,
  CreditCard,
  Loader2,
  LocateFixed,
  MapPin,
  Receipt,
  Smartphone,
  Store,
  Wallet,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FoodImage } from "@/components/brand/food-image";
import { Price } from "@/components/brand/price";
import {
  useCartView,
  useCatalog,
} from "@/components/providers/catalog-provider";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCard, RadioGroup } from "@/components/ui/controls";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart-store";
import { formatClock, getOpenStatus, RESTAURANT_TZ } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { EG_MOBILE_REGEX, normalizeEgyptianPhone } from "@/lib/phone";
import { loadContact, rememberOrder, saveContact } from "@/lib/recent-orders";
import { scheduleSlots } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { placeOrderAction } from "@/server/actions/orders";
import type { PaymentToggles } from "@/types/catalog";

const MapPicker = dynamic(() => import("./map-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
});

export interface SavedAddress {
  id: string;
  zoneId: string;
  street: string;
  building: string;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

type PaymentKey = keyof PaymentToggles;

export function CheckoutForm({
  profile,
  savedAddresses,
}: {
  profile: { name: string | null; phone: string | null } | null;
  savedAddresses: SavedAddress[];
}) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const tp = useTranslations("payment");
  const tcommon = useTranslations("common");
  const router = useRouter();
  const { zones, settings } = useCatalog();
  const view = useCartView();
  const { setFulfillment, setZone, clear } = useCart();
  const fulfillment = useCart((s) => s.fulfillment);
  const promo = useCart((s) => s.promo);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const placed = useRef(false);
  const L = (ar: string | null, en: string | null) =>
    (locale === "ar" ? ar : en) ?? "";

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const open = getOpenStatus(now, settings.hours);
  const canAsap = open.isOpen && settings.ordering.acceptingOrders;
  const canSchedule =
    settings.ordering.maxScheduleDays > 0 &&
    (open.isOpen || settings.ordering.allowScheduledWhenClosed);
  const days = useMemo(
    () =>
      scheduleSlots(
        now,
        settings.hours,
        settings.ordering.minScheduleLeadMinutes,
        settings.ordering.maxScheduleDays,
      ),
    // recompute per minute
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(now.getTime() / 60_000), settings],
  );

  const paymentOptions = (
    ["cash", "card", "wallet", "fawry", "valu", "instapay"] as const
  ).filter(
    (k) =>
      settings.payments[k] && (k !== "instapay" || settings.instapay.enabled),
  );

  const schema = z
    .object({
      name: z.string().trim().min(2, t("errors.required")).max(80),
      phone: z
        .string()
        .transform(normalizeEgyptianPhone)
        .refine((v) => EG_MOBILE_REGEX.test(v), t("errors.phone")),
      zoneId: z.string().optional(),
      street: z.string().trim().max(120).optional(),
      building: z.string().trim().max(30).optional(),
      floor: z.string().trim().max(10).optional(),
      apartment: z.string().trim().max(10).optional(),
      landmark: z.string().trim().max(120).optional(),
      timing: z.enum(["asap", "scheduled"]),
      day: z.string().optional(),
      slot: z.string().optional(),
      paymentMethod: z.enum([
        "cash",
        "card",
        "wallet",
        "fawry",
        "valu",
        "instapay",
      ]),
      notes: z.string().max(500).optional(),
      saveAddress: z.boolean().optional(),
    })
    .superRefine((v, ctx) => {
      if (fulfillment === "delivery") {
        if (!v.zoneId)
          ctx.addIssue({
            code: "custom",
            path: ["zoneId"],
            message: t("errors.required"),
          });
        if (!v.street || v.street.length < 2)
          ctx.addIssue({
            code: "custom",
            path: ["street"],
            message: t("errors.required"),
          });
        if (!v.building)
          ctx.addIssue({
            code: "custom",
            path: ["building"],
            message: t("errors.required"),
          });
      }
      if (v.timing === "scheduled" && !v.slot)
        ctx.addIssue({
          code: "custom",
          path: ["slot"],
          message: t("errors.required"),
        });
    });
  type FormValues = z.input<typeof schema>;

  const defaultAddress =
    savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      zoneId: view.zone?.id ?? defaultAddress?.zoneId ?? "",
      street: defaultAddress?.street ?? "",
      building: defaultAddress?.building ?? "",
      floor: defaultAddress?.floor ?? "",
      apartment: defaultAddress?.apartment ?? "",
      landmark: defaultAddress?.landmark ?? "",
      timing: canAsap ? "asap" : "scheduled",
      day: "",
      slot: "",
      paymentMethod: "cash",
      notes: "",
      saveAddress: Boolean(profile),
    },
  });
  const { register, control, watch, setValue, formState, handleSubmit } = form;
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    defaultAddress?.lat != null && defaultAddress?.lng != null
      ? { lat: defaultAddress.lat, lng: defaultAddress.lng }
      : null,
  );

  // Prefill guest details from the last order on this device.
  useEffect(() => {
    if (profile) return;
    const c = loadContact();
    for (const [k, v] of Object.entries(c)) {
      if (v && !form.getValues(k as keyof FormValues))
        setValue(k as keyof FormValues, v as never);
    }
    if (c.zoneId && !view.zone) setZone(c.zoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoneId = watch("zoneId");
  useEffect(() => {
    if (zoneId) setZone(zoneId);
  }, [zoneId, setZone]);
  useEffect(() => {
    if (!canAsap && form.getValues("timing") === "asap")
      setValue("timing", "scheduled");
  }, [canAsap, form, setValue]);

  // An empty cart has nothing to check out (but don't bounce right after placing an order).
  useEffect(() => {
    if (view.hydrated && view.lines.length === 0 && !placed.current)
      router.replace("/cart");
  }, [view.hydrated, view.lines.length, router]);

  const timing = watch("timing");
  const day = watch("day") || days[0]?.key || "";
  const dayObj = days.find((d) => d.key === day) ?? days[0];
  const paymentMethod = watch("paymentMethod") as PaymentKey;
  const p = view.pricing;
  const zone = zones.find((z) => z.id === zoneId) ?? null;

  const dayLabel = (d: Date, idx: number) =>
    idx === 0 && days[0]?.key === dayKeyOf(new Date())
      ? t("today")
      : new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
          timeZone: RESTAURANT_TZ,
          weekday: "long",
          day: "numeric",
          month: "short",
        }).format(d);

  function dayKeyOf(d: Date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: RESTAURANT_TZ }).format(
      d,
    );
  }

  const locate = () => {
    if (!navigator.geolocation) return toast.error(t("pinFailed"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success(t("pinSet"));
      },
      () => {
        setLocating(false);
        toast.error(t("pinFailed"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const onSubmit = handleSubmit((v) => {
    const values = v as unknown as Required<FormValues> & { phone: string };
    const payload = {
      lines: view.lines.map((l) => ({
        menuItemId: l.menuItemId,
        sizeId: l.sizeId,
        addonIds: l.addonIds,
        quantity: l.quantity,
        notes: l.notes || null,
      })),
      fulfillment,
      zoneId: fulfillment === "delivery" ? values.zoneId : null,
      address:
        fulfillment === "delivery"
          ? {
              street: values.street,
              building: values.building,
              floor: values.floor || null,
              apartment: values.apartment || null,
              landmark: values.landmark || null,
              lat: pin?.lat ?? null,
              lng: pin?.lng ?? null,
            }
          : null,
      customer: { name: values.name, phone: values.phone },
      scheduledFor:
        values.timing === "scheduled" && values.slot ? values.slot : null,
      paymentMethod: values.paymentMethod,
      promoCode: promo?.code ?? null,
      notes: values.notes || null,
      locale,
      saveAddress: Boolean(values.saveAddress),
    };
    startTransition(async () => {
      const res = await placeOrderAction(payload);
      if (!res.ok) {
        const code = res.error.code;
        if (code === "PAYMENT_PROVIDER" && "trackingToken" in res.error) {
          toast.error(t("errors.PAYMENT_PROVIDER"));
          placed.current = true;
          clear();
          router.push(`/orders/${res.error.trackingToken}`);
          return;
        }
        toast.error(t(`errors.${code}`));
        if (code === "PRICING") router.push("/cart");
        return;
      }
      saveContact({
        name: values.name,
        phone: values.phone,
        zoneId: values.zoneId,
        street: values.street,
        building: values.building,
        floor: values.floor,
        apartment: values.apartment,
        landmark: values.landmark,
      });
      rememberOrder({
        token: res.trackingToken,
        number: res.orderNumber,
        placedAt: new Date().toISOString(),
      });
      placed.current = true;
      clear();
      if (res.redirectUrl) {
        window.location.assign(res.redirectUrl);
      } else {
        router.push(`/orders/${res.trackingToken}`);
      }
    });
  });

  if (!view.hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-[40rem] rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (view.lines.length === 0) {
    return (
      <div className="grid min-h-60 place-items-center">
        <Loader2 className="size-8 animate-spin text-ember-400" aria-hidden />
      </div>
    );
  }

  const err = (k: keyof FormValues) =>
    formState.errors[k]?.message as string | undefined;
  const PAYMENT_META: Record<
    PaymentKey,
    { icon: typeof Banknote; hint: string }
  > = {
    cash: { icon: Banknote, hint: t("cashHint") },
    card: { icon: CreditCard, hint: t("cardHint") },
    wallet: { icon: Smartphone, hint: t("walletHint") },
    fawry: { icon: Receipt, hint: t("fawryHint") },
    valu: { icon: Wallet, hint: t("valuHint") },
    instapay: { icon: Zap, hint: t("instapayHint") },
  };
  const minEta =
    zone?.etaMinMinutes ?? Math.min(...zones.map((z) => z.etaMinMinutes));
  const maxEta =
    zone?.etaMaxMinutes ?? Math.max(...zones.map((z) => z.etaMaxMinutes));
  const belowMin = p.errors.find((e) => e.code === "BELOW_MIN_ORDER");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-10"
    >
      <div className="flex flex-col gap-5">
        {!settings.ordering.acceptingOrders ? (
          <Banner>{t("pausedBanner")}</Banner>
        ) : !open.isOpen ? (
          <Banner>
            {t("closedBanner", {
              time: open.opensAt ? formatClock(open.opensAt, locale) : "12:00",
            })}
          </Banner>
        ) : null}

        {/* Contact */}
        <Section title={t("contact")} step={1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="name" error={err("name")}>
              <Input
                id="name"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                aria-invalid={Boolean(err("name"))}
                {...register("name")}
              />
            </Field>
            <Field
              label={t("phone")}
              htmlFor="phone"
              hint={t("phoneHint")}
              error={err("phone")}
            >
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                dir="ltr"
                className="text-start"
                placeholder="01X XXXX XXXX"
                aria-invalid={Boolean(err("phone"))}
                aria-describedby={err("phone") ? "phone-error" : "phone-hint"}
                {...register("phone")}
              />
            </Field>
          </div>
        </Section>

        {/* Fulfillment + address */}
        <Section title={t("fulfillment")} step={2}>
          <div
            className="grid grid-cols-2 gap-2 rounded-full border border-border-strong bg-coal-850 p-1"
            role="radiogroup"
            aria-label={t("fulfillment")}
          >
            {(
              [
                ["delivery", tc("deliveryOption"), Bike],
                ["pickup", tc("pickupOption"), Store],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={fulfillment === value}
                onClick={() => setFulfillment(value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
                  fulfillment === value
                    ? "bg-ember-400 text-coal-950"
                    : "text-smoke-200 hover:text-cream-50",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {fulfillment === "delivery" ? (
            <div className="mt-5 flex flex-col gap-4">
              {savedAddresses.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("savedAddresses")}
                  </span>
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setValue("zoneId", a.zoneId, {
                            shouldValidate: true,
                          });
                          setValue("street", a.street, {
                            shouldValidate: true,
                          });
                          setValue("building", a.building, {
                            shouldValidate: true,
                          });
                          setValue("floor", a.floor ?? "");
                          setValue("apartment", a.apartment ?? "");
                          setValue("landmark", a.landmark ?? "");
                          setPin(
                            a.lat != null && a.lng != null
                              ? { lat: a.lat, lng: a.lng }
                              : null,
                          );
                        }}
                        className="flex max-w-60 shrink-0 items-start gap-2 rounded-xl border border-border-strong bg-coal-850 p-3 text-start text-sm hover:border-ember-400/50"
                      >
                        <MapPin
                          className="mt-0.5 size-4 shrink-0 text-ember-400"
                          aria-hidden
                        />
                        <span className="line-clamp-2">
                          {L(
                            zones.find((z) => z.id === a.zoneId)?.nameAr ?? "",
                            zones.find((z) => z.id === a.zoneId)?.nameEn ?? "",
                          )}{" "}
                          · {a.street} {a.building}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Field label={t("area")} htmlFor="zoneId" error={err("zoneId")}>
                <NativeSelect
                  id="zoneId"
                  aria-invalid={Boolean(err("zoneId"))}
                  {...register("zoneId")}
                >
                  <option value="" disabled>
                    {tc("chooseArea")}
                  </option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {L(z.nameAr, z.nameEn)} —{" "}
                      {formatMoney(z.feePiasters, locale)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t("street")} htmlFor="street" error={err("street")}>
                <Input
                  id="street"
                  autoComplete="address-line1"
                  placeholder={t("streetPlaceholder")}
                  aria-invalid={Boolean(err("street"))}
                  {...register("street")}
                />
              </Field>
              <div className="grid grid-cols-3 items-end gap-3">
                <Field
                  label={t("building")}
                  htmlFor="building"
                  error={err("building")}
                >
                  <Input
                    id="building"
                    inputMode="text"
                    aria-invalid={Boolean(err("building"))}
                    {...register("building")}
                  />
                </Field>
                <Field label={t("floor")} htmlFor="floor">
                  <Input
                    id="floor"
                    inputMode="numeric"
                    {...register("floor")}
                  />
                </Field>
                <Field label={t("apartment")} htmlFor="apartment">
                  <Input
                    id="apartment"
                    inputMode="numeric"
                    {...register("apartment")}
                  />
                </Field>
              </div>
              <Field label={t("landmark")} htmlFor="landmark">
                <Input
                  id="landmark"
                  placeholder={t("landmarkPlaceholder")}
                  {...register("landmark")}
                />
              </Field>

              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong p-4">
                <span className="text-sm font-medium">{t("pin")}</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={locate}
                    disabled={locating}
                  >
                    {locating ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <LocateFixed aria-hidden />
                    )}
                    {locating ? t("locating") : t("useMyLocation")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMap((v) => !v)}
                    aria-expanded={showMap}
                  >
                    <MapPin aria-hidden />
                    {t("pickOnMap")}
                  </Button>
                  {pin && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-zaatar-900 px-3 text-xs font-semibold text-zaatar-300">
                      {t("pinSet")}
                      <bdi dir="ltr" className="tabular font-normal opacity-80">
                        {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                      </bdi>
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setPin(null)}
                      >
                        {t("removePin")}
                      </button>
                    </span>
                  )}
                </div>
                {showMap && (
                  <MapPicker
                    center={settings.restaurant}
                    value={pin}
                    onChange={setPin}
                    label={t("pin")}
                  />
                )}
              </div>

              {Boolean(savedAddresses.length || profile) && (
                <label className="flex items-center gap-3 text-sm">
                  <Controller
                    control={control}
                    name="saveAddress"
                    render={({ field }) => (
                      <Checkbox
                        checked={Boolean(field.value)}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    )}
                  />
                  {t("saveAddress")}
                </label>
              )}
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-smoke-300">
              <Store className="size-4 text-ember-400" aria-hidden />
              {L(
                settings.restaurant.addressAr,
                settings.restaurant.addressEn,
              )}{" "}
              · {tc("pickupHint", { min: settings.ordering.pickupEtaMinutes })}
            </p>
          )}
        </Section>

        {/* Timing */}
        <Section title={t("timing")} step={3}>
          <Controller
            control={control}
            name="timing"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-2.5 sm:grid-cols-2"
              >
                <RadioCard value="asap" disabled={!canAsap}>
                  <Zap className="size-5 text-ember-400" aria-hidden />
                  <span className="flex flex-col">
                    <span className="font-semibold">{t("asap")}</span>
                    <span className="text-xs text-smoke-300">
                      {fulfillment === "delivery"
                        ? tcommon("etaRange", { min: minEta, max: maxEta })
                        : t("pickupAsap", {
                            min: settings.ordering.pickupEtaMinutes,
                          })}
                    </span>
                  </span>
                </RadioCard>
                <RadioCard
                  value="scheduled"
                  disabled={!canSchedule || days.length === 0}
                >
                  <CalendarClock
                    className="size-5 text-ember-400"
                    aria-hidden
                  />
                  <span className="font-semibold">{t("scheduled")}</span>
                </RadioCard>
              </RadioGroup>
            )}
          />
          {timing === "scheduled" && days.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={t("day")} htmlFor="day">
                <NativeSelect
                  id="day"
                  value={day}
                  onChange={(e) => {
                    setValue("day", e.target.value);
                    setValue("slot", "");
                  }}
                >
                  {days.map((d, i) => (
                    <option key={d.key} value={d.key}>
                      {dayLabel(d.date, i)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t("time")} htmlFor="slot" error={err("slot")}>
                <NativeSelect
                  id="slot"
                  aria-invalid={Boolean(err("slot"))}
                  {...register("slot")}
                >
                  <option value="">—</option>
                  {dayObj?.slots.map((s) => (
                    <option key={s.toISOString()} value={s.toISOString()}>
                      {formatClock(s, locale)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
        </Section>

        {/* Payment */}
        <Section title={t("payment")} step={4}>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-2.5"
              >
                {paymentOptions.map((k) => {
                  const Icon = PAYMENT_META[k].icon;
                  return (
                    <RadioCard key={k} value={k}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-coal-700 text-ember-300">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold">{tp(k)}</span>
                        <span className="text-xs text-smoke-300">
                          {PAYMENT_META[k].hint}
                        </span>
                        {k === "instapay" && (
                          <bdi
                            dir="ltr"
                            className="mt-0.5 font-mono text-xs text-ember-300"
                          >
                            {settings.instapay.handle}
                          </bdi>
                        )}
                      </span>
                    </RadioCard>
                  );
                })}
              </RadioGroup>
            )}
          />
          <Field label={t("orderNotes")} htmlFor="notes" className="mt-5">
            <Textarea
              id="notes"
              maxLength={500}
              placeholder={t("orderNotesPlaceholder")}
              {...register("notes")}
            />
          </Field>
        </Section>
      </div>

      {/* Summary */}
      <aside
        aria-label={t("summary")}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-24"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold">{t("summary")}</h2>
          <Link href="/cart" className="text-sm text-ember-300 hover:underline">
            {t("edit")}
          </Link>
        </div>
        <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto pe-1 pt-2">
          {view.lines.map((l, i) => (
            <li key={l.key} className="flex items-center gap-3">
              <span className="relative">
                <FoodImage
                  src={l.item.imageUrl}
                  alt=""
                  category={l.item.categorySlug}
                  sizes="56px"
                  className="size-14 rounded-lg"
                />
                <span className="tabular absolute -end-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-ember-400 px-1 text-[0.7rem] font-bold text-coal-950">
                  {l.quantity}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {L(l.item.nameAr, l.item.nameEn)}
                </span>
                {p.lines[i]?.sizeNameAr && (
                  <span className="text-xs text-smoke-400">
                    {L(p.lines[i]!.sizeNameAr, p.lines[i]!.sizeNameEn)}
                  </span>
                )}
              </span>
              {p.lines[i] && (
                <Price
                  piasters={p.lines[i]!.lineTotalPiasters}
                  locale={locale}
                  className="text-sm"
                />
              )}
            </li>
          ))}
        </ul>
        <div className="hairline" />
        <dl className="flex flex-col gap-2 text-sm">
          <Row label={tc("subtotal")}>
            <Price piasters={p.subtotalPiasters} locale={locale} />
          </Row>
          {p.discountPiasters > 0 && (
            <Row
              label={`${tc("discount")} · ${p.promo?.code}`}
              className="text-zaatar-300"
            >
              −<Price piasters={p.discountPiasters} locale={locale} />
            </Row>
          )}
          <Row label={tc("delivery")}>
            {fulfillment === "pickup" ? (
              <span className="font-semibold text-zaatar-300">
                {tc("free")}
              </span>
            ) : zone ? (
              <Price piasters={p.deliveryFeePiasters} locale={locale} />
            ) : (
              <span className="text-xs text-smoke-400">—</span>
            )}
          </Row>
          {!p.pricesIncludeVat && (
            <Row label={tc("vat", { rate: p.vatRateBps / 100 })}>
              <Price piasters={p.vatPiasters} locale={locale} />
            </Row>
          )}
          <div className="hairline my-1" />
          <Row label={tc("total")} className="text-base font-semibold">
            <Price
              piasters={p.totalPiasters}
              locale={locale}
              className="text-2xl text-cream-50"
            />
          </Row>
          {p.pricesIncludeVat && (
            <p className="text-xs text-smoke-400">
              {tc("vatIncluded", { rate: p.vatRateBps / 100 })}
            </p>
          )}
        </dl>
        {belowMin && zone && (
          <p className="rounded-xl border border-flame-400/30 bg-flame-400/10 p-3 text-sm text-flame-300">
            {tc("belowMin", {
              amount: formatMoney(
                zone.minOrderPiasters - p.subtotalPiasters,
                locale,
              ),
              zone: L(zone.nameAr, zone.nameEn),
            })}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full justify-between"
          disabled={pending || Boolean(belowMin) || (!canAsap && !canSchedule)}
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" aria-hidden />
              {t("placing")}
            </span>
          ) : (
            <span>
              {["card", "wallet", "fawry", "valu"].includes(paymentMethod)
                ? t("payAndPlace")
                : t("place")}
            </span>
          )}
          <Price piasters={p.totalPiasters} locale={locale} />
        </Button>
        <p className="text-xs leading-relaxed text-smoke-400">{t("terms")}</p>
      </aside>
    </form>
  );
}

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-sans text-lg font-semibold">
        <span className="tabular grid size-7 place-items-center rounded-full bg-ember-400 text-sm font-bold text-coal-950">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <dt className={cn(!className && "text-smoke-300")}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-flame-400/30 bg-flame-400/10 p-4 text-sm text-flame-300"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

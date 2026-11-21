"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bike,
  Check,
  Copy,
  CreditCard,
  ImageUp,
  Loader2,
  MapPin,
  MessageCircle,
  RotateCcw,
  Store,
  XCircle,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Price } from "@/components/brand/price";
import { StatusTracker } from "@/components/order/status-tracker";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart-store";
import { RESTAURANT_TZ } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { useRealtime } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import {
  retryPaymentAction,
  switchToCashAction,
} from "@/server/actions/orders";
import type { OrderDetail } from "@/server/services/orders";

export function TrackingView({ order }: { order: OrderDetail }) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("order");
  const tc = useTranslations("cart");
  const ts = useTranslations("status");
  const tp = useTranslations("payment");
  const tcommon = useTranslations("common");
  const router = useRouter();
  const search = useSearchParams();
  const { settings, itemsById } = useCatalog();
  const add = useCart((s) => s.add);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);
  const prevStatus = useRef(order.status);
  const L = (ar: string | null, en: string | null) =>
    (locale === "ar" ? ar : en) ?? "";

  useRealtime(`order:${order.trackingToken}`, () => router.refresh(), 20_000);

  useEffect(() => {
    if (prevStatus.current !== order.status) {
      prevStatus.current = order.status;
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 1600);
      if ("vibrate" in navigator) navigator.vibrate?.(80);
      return () => window.clearTimeout(id);
    }
  }, [order.status]);

  useEffect(() => {
    const p = search.get("payment");
    if (p === "success") toast.success(t("paymentSuccess"));
    if (p === "failed") toast.error(t("paymentFailed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (iso: string, withDay = false) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      timeZone: RESTAURANT_TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
    }).format(new Date(iso));

  const reorder = () => {
    let added = 0;
    for (const it of order.items) {
      if (!it.menuItemId) continue;
      const live = itemsById.get(it.menuItemId);
      if (!live || live.isSoldOut) continue;
      const liveAddonIds = new Set(
        live.addonGroups.flatMap((g) => g.addons.map((a) => a.id)),
      );
      add({
        menuItemId: it.menuItemId,
        slug: live.slug,
        sizeId:
          it.sizeId && live.sizes.some((s) => s.id === it.sizeId)
            ? it.sizeId
            : (live.sizes[0]?.id ?? null),
        addonIds: it.addons
          .map((a) => a.addonId)
          .filter((x): x is string => Boolean(x && liveAddonIds.has(x))),
        quantity: it.quantity,
        notes: it.notes ?? "",
      });
      added++;
    }
    if (added) {
      toast.success(t("reordered"));
      router.push("/cart");
    }
  };

  const isPendingPayment = order.status === "pending_payment";
  const wa = `https://wa.me/${settings.restaurant.whatsapp}?text=${encodeURIComponent(`${locale === "ar" ? "بخصوص أوردر" : "About order"} #${order.orderNumber}`)}`;
  const etaMin =
    order.fulfillmentType === "delivery"
      ? order.zone?.etaMinMinutes
      : settings.ordering.pickupEtaMinutes;
  const etaMax =
    order.fulfillmentType === "delivery"
      ? order.zone?.etaMaxMinutes
      : settings.ordering.pickupEtaMinutes + 10;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
      <div className="flex flex-col gap-5">
        {/* Status */}
        <Card
          className={cn(
            "grain overflow-hidden p-5 transition-shadow duration-700 md:p-8",
            flash &&
              "shadow-[0_0_0_2px_var(--color-ember-400),0_0_60px_rgb(255_138_69/0.35)]",
          )}
        >
          <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-smoke-300">
                {t("title", { number: order.orderNumber })}
              </p>
              <h2 className="mt-1 text-3xl md:text-4xl" aria-live="polite">
                {ts(order.status)}
              </h2>
              <p className="mt-2 text-sm text-smoke-300">
                {order.scheduledFor
                  ? t("scheduledFor", { time: fmt(order.scheduledFor, true) })
                  : t("placedAt", { time: fmt(order.placedAt) })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="zaatar" className="gap-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-zaatar-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-zaatar-400" />
                </span>
                {t("live")}
              </Badge>
              {!["delivered", "cancelled", "pending_payment"].includes(
                order.status,
              ) &&
                etaMin &&
                etaMax &&
                !order.scheduledFor && (
                  <Badge variant="ember">
                    {tcommon("etaRange", { min: etaMin, max: etaMax })}
                  </Badge>
                )}
            </div>
          </div>
          {order.status === "cancelled" ? (
            <div className="flex items-start gap-3 rounded-xl border border-chili-400/30 bg-chili-900/60 p-4 text-chili-400">
              <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold">{ts("cancelled")}</p>
                {order.cancelReason && (
                  <p className="mt-1 opacity-90">
                    {t("cancelledReason", { reason: order.cancelReason })}
                  </p>
                )}
              </div>
            </div>
          ) : isPendingPayment ? null : (
            <StatusTracker
              status={order.status}
              fulfillment={order.fulfillmentType}
            />
          )}
        </Card>

        {/* Payment action panels */}
        {isPendingPayment &&
          order.paymentMethod === "instapay" &&
          order.payment && (
            <InstapayPanel
              order={order}
              handle={settings.instapay.handle}
              accountName={settings.instapay.accountName}
              onDone={() => router.refresh()}
            />
          )}
        {isPendingPayment &&
          order.paymentMethod !== "instapay" &&
          order.payment && (
            <Card className="flex flex-col gap-4 p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ember-900 text-ember-300">
                  <CreditCard className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-sans text-lg font-semibold">
                    {order.paymentStatus === "failed"
                      ? t("failed")
                      : t("payPending")}
                  </h3>
                  <p className="text-sm text-smoke-300">
                    {order.paymentStatus === "failed"
                      ? t("paymentFailed")
                      : t("payPendingHint")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await retryPaymentAction({
                        paymentId: order.payment!.id,
                        locale,
                      });
                      if ("redirectUrl" in r)
                        window.location.assign(r.redirectUrl);
                      else toast.error(t("paymentFailed"));
                    })
                  }
                >
                  {pending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <CreditCard aria-hidden />
                  )}
                  {t("payNow")} ·{" "}
                  <Price piasters={order.totalPiasters} locale={locale} />
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      if (await switchToCashAction(order.trackingToken))
                        router.refresh();
                    })
                  }
                >
                  {t("switchToCash")}
                </Button>
              </div>
            </Card>
          )}

        {/* Items */}
        <Card className="p-5 md:p-6">
          <h3 className="mb-4 font-sans text-lg font-semibold">{t("items")}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {order.items.map((it) => (
              <li
                key={it.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="tabular text-ember-300">
                      {it.quantity}×
                    </span>{" "}
                    {L(it.nameAr, it.nameEn)}
                  </p>
                  {(it.sizeNameAr || it.addons.length > 0) && (
                    <p className="text-xs text-smoke-300">
                      {[
                        it.sizeNameAr ? L(it.sizeNameAr, it.sizeNameEn) : null,
                        ...it.addons.map((a) => L(a.nameAr, a.nameEn)),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {it.notes && (
                    <p className="text-xs italic text-smoke-400">
                      “{it.notes}”
                    </p>
                  )}
                </div>
                <Price
                  piasters={it.lineTotalPiasters}
                  locale={locale}
                  className="text-sm"
                />
              </li>
            ))}
          </ul>
          <div className="hairline my-4" />
          <dl className="flex flex-col gap-2 text-sm">
            <Row label={tc("subtotal")}>
              <Price piasters={order.subtotalPiasters} locale={locale} />
            </Row>
            {order.discountPiasters > 0 && (
              <Row
                label={`${tc("discount")} · ${order.promoCode ?? ""}`}
                className="text-zaatar-300"
              >
                −<Price piasters={order.discountPiasters} locale={locale} />
              </Row>
            )}
            <Row label={tc("delivery")}>
              {order.fulfillmentType === "pickup" ? (
                <span className="text-zaatar-300">{tc("free")}</span>
              ) : (
                <Price piasters={order.deliveryFeePiasters} locale={locale} />
              )}
            </Row>
            {!order.pricesIncludeVat && (
              <Row label={tc("vat", { rate: order.vatRateBps / 100 })}>
                <Price piasters={order.vatPiasters} locale={locale} />
              </Row>
            )}
            <Row label={tc("total")} className="pt-1 text-base font-semibold">
              <Price
                piasters={order.totalPiasters}
                locale={locale}
                className="text-xl text-cream-50"
              />
            </Row>
            {order.pricesIncludeVat && (
              <p className="text-xs text-smoke-400">
                {tc("vatIncluded", { rate: order.vatRateBps / 100 })} ·{" "}
                {formatMoney(order.vatPiasters, locale)}
              </p>
            )}
          </dl>
        </Card>
      </div>

      {/* Side details */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            {order.fulfillmentType === "delivery" ? (
              <Bike className="mt-0.5 size-5 text-ember-400" aria-hidden />
            ) : (
              <Store className="mt-0.5 size-5 text-ember-400" aria-hidden />
            )}
            <div className="text-sm">
              <p className="font-semibold">
                {order.fulfillmentType === "delivery"
                  ? t("deliverTo")
                  : t("pickupFrom")}
              </p>
              {order.fulfillmentType === "delivery" ? (
                <p className="text-smoke-300">
                  {L(order.zone?.nameAr ?? "", order.zone?.nameEn ?? "")} ·{" "}
                  {order.address.street} {order.address.building}
                  {order.address.floor
                    ? ` · ${locale === "ar" ? "الدور" : "Floor"} ${order.address.floor}`
                    : ""}
                  {order.address.apartment
                    ? ` · ${locale === "ar" ? "شقة" : "Apt"} ${order.address.apartment}`
                    : ""}
                  {order.address.landmark ? (
                    <span className="block text-smoke-400">
                      {order.address.landmark}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-smoke-300">
                  {L(
                    settings.restaurant.addressAr,
                    settings.restaurant.addressEn,
                  )}
                </p>
              )}
              {order.address.lat != null && order.address.lng != null && (
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs text-ember-300 hover:underline"
                  href={`https://www.google.com/maps/search/?api=1&query=${order.address.lat},${order.address.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="size-3" aria-hidden /> Maps
                </a>
              )}
            </div>
          </div>
          <div className="hairline" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-smoke-300">{t("paymentMethod")}</span>
            <span className="flex items-center gap-2 font-medium">
              {tp(order.paymentMethod)}
              {!(
                order.paymentMethod === "cash" &&
                order.paymentStatus === "unpaid"
              ) && (
                <Badge
                  variant={
                    order.paymentStatus === "paid"
                      ? "zaatar"
                      : order.paymentStatus === "failed"
                        ? "chili"
                        : "default"
                  }
                >
                  {order.paymentStatus === "paid" ? (
                    <>
                      <Check aria-hidden /> {t("paid")}
                    </>
                  ) : order.paymentStatus === "pending_review" ? (
                    t("pendingReview")
                  ) : order.paymentStatus === "failed" ? (
                    t("failed")
                  ) : order.paymentMethod === "cash" ? (
                    t("unpaid")
                  ) : (
                    t("payPending")
                  )}
                </Badge>
              )}
            </span>
          </div>
          <div className="text-sm text-smoke-300">
            {order.customerName} ·{" "}
            <bdi dir="ltr">{formatPhone(order.customerPhone)}</bdi>
          </div>
        </Card>
        <Button variant="secondary" size="lg" onClick={reorder}>
          <RotateCcw aria-hidden />
          {t("reorder")}
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            {t("help")}
          </a>
        </Button>
      </aside>
    </div>
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

function InstapayPanel({
  order,
  handle,
  accountName,
  onDone,
}: {
  order: OrderDetail;
  handle: string;
  accountName: string;
  onDone: () => void;
}) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("order");
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const status = order.payment?.status;
  const rejected = status === "failed";

  if (status === "pending_review") {
    return (
      <Card className="flex items-start gap-3 border-zaatar-400/30 bg-zaatar-900/30 p-5">
        <Check className="mt-0.5 size-5 shrink-0 text-zaatar-300" aria-hidden />
        <p className="text-sm text-zaatar-300">{t("instapayUploaded")}</p>
      </Card>
    );
  }

  const upload = async () => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error(t("fileTooLarge"));
    setBusy(true);
    const body = new FormData();
    body.set("proof", file);
    if (ref.trim()) body.set("payerReference", ref.trim());
    const res = await fetch(`/api/orders/${order.trackingToken}/instapay`, {
      method: "POST",
      body,
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    setBusy(false);
    if (res.ok) {
      toast.success(t("instapayUploaded"));
      onDone();
    } else
      toast.error(
        res.error === "TOO_LARGE" ? t("fileTooLarge") : t("fileBadType"),
      );
  };

  return (
    <Card className="flex flex-col gap-5 p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-ember-900 text-ember-300">
          <Zap className="size-5" aria-hidden />
        </span>
        <h3 className="font-sans text-lg font-semibold">
          {t("instapayTitle")}
        </h3>
      </div>
      {rejected && (
        <p className="flex items-start gap-2 rounded-xl border border-chili-400/30 bg-chili-900/60 p-3 text-sm text-chili-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("instapayRejected", { note: order.payment?.reviewNote ?? "—" })}
        </p>
      )}
      <ol className="flex flex-col gap-4 text-sm">
        <li className="flex flex-col gap-2">
          <span>
            <span className="tabular me-2 inline-grid size-6 place-items-center rounded-full bg-coal-700 text-xs font-bold">
              1
            </span>
            {t("instapayStep1", {
              amount: formatMoney(order.totalPiasters, locale),
            })}
          </span>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-ember-400/50 bg-coal-850 px-4 py-3">
            <span className="flex flex-col">
              <bdi
                dir="ltr"
                className="font-mono text-base font-semibold text-ember-300"
              >
                {handle}
              </bdi>
              <span className="text-xs text-smoke-400">{accountName}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(handle).catch(() => {});
                toast.success(t("copied"));
              }}
            >
              <Copy aria-hidden />
              {t("copyHandle")}
            </Button>
          </div>
        </li>
        <li className="flex flex-col gap-3">
          <span>
            <span className="tabular me-2 inline-grid size-6 place-items-center rounded-full bg-coal-700 text-xs font-bold">
              2
            </span>
            {t("instapayStep2")}
          </span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-coal-850 p-6 text-center transition-colors hover:border-ember-400/60">
            <ImageUp className="size-7 text-ember-400" aria-hidden />
            <span className="text-sm font-medium">
              {file ? file.name : t("instapayUpload")}
            </span>
            <span className="text-xs text-smoke-400">
              JPG · PNG · WEBP · ≤ 5 MB
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={t("instapayRef")}
            maxLength={60}
            aria-label={t("instapayRef")}
          />
          <Button size="lg" disabled={!file || busy} onClick={upload}>
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ImageUp aria-hidden />
            )}
            {busy ? t("instapayUploading") : t("instapayUpload")}
          </Button>
        </li>
      </ol>
    </Card>
  );
}

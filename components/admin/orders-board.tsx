"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  BellOff,
  Bike,
  CalendarClock,
  Loader2,
  MessageSquareText,
  Phone,
  Printer,
  Store,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Price } from "@/components/brand/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/hours";
import { nextStatuses, type OrderStatus } from "@/lib/order-status";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { useRealtime } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import {
  advanceOrderAction,
  assignDriverAction,
  boardAction,
} from "@/server/actions/admin";
import type { BoardData, BoardOrder } from "@/server/services/admin";

/** Two-tone "ding-dong" made with Web Audio (no asset to download). */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 660, 880].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.35, now + i * 0.22 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.22);
    o.stop(now + i * 0.22 + 0.55);
  });
}

const CANCEL_REASONS_AR = [
  "العميل لغى الطلب",
  "الصنف خلص",
  "العنوان خارج مناطق التوصيل",
  "مش قادرين نوصل للعميل",
];
const CANCEL_REASONS_EN = [
  "Customer cancelled",
  "Item sold out",
  "Address outside delivery zones",
  "Couldn't reach the customer",
];

export function OrdersBoard({
  initial,
  roles,
  userId,
}: {
  initial: BoardData;
  roles: string[];
  userId: string;
}) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("admin.board");
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [soundOn, setSoundOn] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const known = useRef(new Set(initial.orders.map((o) => o.id)));
  const driverOnly = roles.every((r) => r === "driver");

  useEffect(() => {
    setSoundOn(localStorage.getItem("fz-admin-sound") === "1");
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const enableSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("fz-admin-sound", next ? "1" : "0");
    if (next) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      chime(audio.current);
    }
  };

  const refresh = useCallback(async () => {
    const res = await boardAction();
    if (!res.ok || !res.data) return;
    const fresh = res.data.orders.filter(
      (o) => !known.current.has(o.id) && o.status === "received",
    );
    res.data.orders.forEach((o) => known.current.add(o.id));
    setData(res.data);
    if (fresh.length) {
      for (const o of fresh)
        toast.success(t("newOrder", { number: o.orderNumber }), {
          duration: 8000,
        });
      if (localStorage.getItem("fz-admin-sound") === "1") {
        audio.current ??= new AudioContext();
        void audio.current.resume().then(() => chime(audio.current!));
      }
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        new Notification(t("newOrder", { number: fresh[0]!.orderNumber }));
      }
    }
  }, [t]);

  useRealtime("staff:orders", () => void refresh(), 15_000);

  const columns: {
    key: string;
    title: string;
    statuses: OrderStatus[];
    accent: string;
  }[] = driverOnly
    ? [
        {
          key: "mine",
          title: t("myDeliveries"),
          statuses: ["out_for_delivery"],
          accent: "bg-zaatar-400",
        },
      ]
    : [
        {
          key: "received",
          title: t("received"),
          statuses: ["received"],
          accent: "bg-ember-400",
        },
        {
          key: "preparing",
          title: t("preparing"),
          statuses: ["preparing"],
          accent: "bg-flame-400",
        },
        {
          key: "ready",
          title: t("ready"),
          statuses: ["ready_for_pickup", "out_for_delivery"],
          accent: "bg-zaatar-400",
        },
      ];
  const awaiting = data.orders.filter((o) => o.status === "pending_payment");
  const activeCount = data.orders.filter(
    (o) => o.status !== "pending_payment",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl md:text-4xl">
            {driverOnly ? t("myDeliveries") : t("title")}
            <Badge variant="zaatar" className="gap-1.5 text-xs">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-zaatar-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-zaatar-400" />
              </span>
              {t("live")}
            </Badge>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!driverOnly && (
            <>
              <Stat
                label={t("todaySales")}
                value={formatMoney(data.today.salesPiasters, locale)}
              />
              <Stat
                label={t("todayOrders")}
                value={String(data.today.orders)}
              />
              <Stat label={t("active")} value={String(activeCount)} />
            </>
          )}
          <Button
            variant={soundOn ? "zaatar" : "outline"}
            size="sm"
            onClick={enableSound}
            aria-pressed={soundOn}
          >
            {soundOn ? <Bell aria-hidden /> : <BellOff aria-hidden />}
            {soundOn ? t("soundOn") : t("soundOff")}
          </Button>
        </div>
      </div>

      {!driverOnly && awaiting.length > 0 && (
        <section
          aria-label={t("awaitingPayment")}
          className="rounded-2xl border border-dashed border-flame-400/40 bg-flame-400/5 p-3"
        >
          <h2 className="mb-2 px-1 font-sans text-sm font-semibold text-flame-300">
            {t("awaitingPayment")} · {awaiting.length}
          </h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto">
            {awaiting.map((o) => (
              <div key={o.id} className="w-72 shrink-0">
                <OrderCard
                  order={o}
                  now={now}
                  drivers={data.drivers}
                  onChanged={refresh}
                  driverOnly={false}
                  userId={userId}
                  compact
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={cn("grid gap-4", !driverOnly && "xl:grid-cols-3")}>
        {columns.map((col) => {
          const list = data.orders.filter((o) =>
            col.statuses.includes(o.status),
          );
          return (
            <section
              key={col.key}
              aria-labelledby={`col-${col.key}`}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-coal-950/40 p-3"
            >
              <h2
                id={`col-${col.key}`}
                className="flex items-center gap-2 px-1 font-sans text-base font-semibold"
              >
                <span
                  className={cn("size-2.5 rounded-full", col.accent)}
                  aria-hidden
                />
                {col.title}
                <span className="tabular ms-auto rounded-full bg-coal-700 px-2 text-xs">
                  {list.length}
                </span>
              </h2>
              <AnimatePresence initial={false}>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-smoke-400">
                    {t("empty")}
                  </p>
                ) : (
                  list.map((o) => (
                    <motion.div
                      key={o.id}
                      layout
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.25 }}
                    >
                      <OrderCard
                        order={o}
                        now={now}
                        drivers={data.drivers}
                        onChanged={refresh}
                        driverOnly={driverOnly}
                        userId={userId}
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order: o,
  now,
  drivers,
  onChanged,
  driverOnly,
  compact = false,
}: {
  order: BoardOrder;
  now: number;
  drivers: BoardData["drivers"];
  onChanged: () => Promise<void>;
  driverOnly: boolean;
  userId: string;
  compact?: boolean;
}) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("admin.board");
  const ts = useTranslations("status");
  const tp = useTranslations("payment");
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const minutes = Math.max(
    0,
    Math.round((now - new Date(o.placedAt).getTime()) / 60_000),
  );
  const late =
    o.status !== "pending_payment" && minutes >= 30 && !o.scheduledFor;
  const next = nextStatuses(o.status, o.fulfillmentType).filter(
    (s) => s !== "cancelled" && (!driverOnly || s === "delivered"),
  );
  const L = (ar: string | null, en: string | null) =>
    (locale === "ar" ? ar : en) ?? "";

  const advance = (to: OrderStatus, cancelReason?: string) =>
    start(async () => {
      const r = await advanceOrderAction({ orderId: o.id, to, cancelReason });
      if (!r.ok) toast.error(t("error"));
      else await onChanged();
    });

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-card",
        late ? "border-chili-400/50" : "border-border",
        o.status === "received" && "ring-1 ring-ember-400/40",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-xl leading-none">#{o.orderNumber}</p>
          <p
            className={cn(
              "mt-1 text-xs",
              late ? "font-semibold text-chili-400" : "text-smoke-400",
            )}
          >
            {minutes < 60 ? t("ago", { min: minutes }) : minutes < 1440 ? t("agoHours", { h: Math.floor(minutes / 60) }) : t("agoDays", { d: Math.floor(minutes / 1440) })}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge
            variant={o.fulfillmentType === "delivery" ? "default" : "zaatar"}
          >
            {o.fulfillmentType === "delivery" ? (
              <Bike aria-hidden />
            ) : (
              <Store aria-hidden />
            )}
            {o.fulfillmentType === "delivery" ? t("delivery") : t("pickup")}
          </Badge>
          {o.scheduledFor && (
            <Badge variant="flame">
              <CalendarClock aria-hidden />
              {formatClock(new Date(o.scheduledFor), locale)}
            </Badge>
          )}
        </div>
      </header>

      <div className="text-sm">
        <p className="font-semibold">{o.customerName}</p>
        <a
          href={`tel:${o.customerPhone}`}
          className="inline-flex items-center gap-1 text-xs text-smoke-300 hover:text-ember-300"
        >
          <Phone className="size-3" aria-hidden />
          <bdi dir="ltr">{formatPhone(o.customerPhone)}</bdi>
        </a>
        {o.fulfillmentType === "delivery" && (
          <p className="mt-1 text-xs text-smoke-300">
            <span className="font-medium text-smoke-200">
              {L(o.zoneAr, o.zoneEn)}
            </span>{" "}
            · {o.address}
            {o.landmark && (
              <span className="block text-smoke-400">{o.landmark}</span>
            )}
          </p>
        )}
      </div>

      {!compact && (
        <ul className="flex flex-col gap-1 border-y border-border py-2 text-sm">
          {o.items.map((it, i) => (
            <li key={i}>
              <span className="tabular font-bold text-ember-300">
                {it.qty}×
              </span>{" "}
              {L(it.nameAr, it.nameEn)}
              {(it.sizeAr || it.addonsAr.length > 0) && (
                <span className="text-xs text-smoke-400">
                  {" "}
                  ·{" "}
                  {[
                    it.sizeAr ? L(it.sizeAr, it.sizeEn) : null,
                    ...(locale === "ar" ? it.addonsAr : it.addonsEn),
                  ]
                    .filter(Boolean)
                    .join("، ")}
                </span>
              )}
              {it.notes && (
                <span className="block text-xs italic text-flame-300">
                  “{it.notes}”
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {o.notes && (
        <p className="flex items-start gap-1.5 rounded-lg bg-flame-400/10 px-2.5 py-2 text-xs text-flame-300">
          <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {o.notes}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-sm">
        <Badge
          variant={
            o.paymentStatus === "paid"
              ? "zaatar"
              : o.paymentStatus === "pending_review"
                ? "flame"
                : "default"
          }
        >
          {o.paymentStatus === "paid"
            ? `${t("paid")} · ${tp(o.paymentMethod)}`
            : o.paymentMethod === "cash"
              ? t("cashDue", { amount: formatMoney(o.totalPiasters, locale) })
              : o.paymentStatus === "pending_review"
                ? t("pendingReview")
                : t("awaitingOnline")}
        </Badge>
        <Price
          piasters={o.totalPiasters}
          locale={locale}
          className="text-base"
        />
      </div>

      {o.fulfillmentType === "delivery" &&
        !driverOnly &&
        ["preparing", "out_for_delivery"].includes(o.status) && (
          <label className="flex items-center gap-2 text-xs text-smoke-300">
            <Bike className="size-4 text-ember-400" aria-hidden />
            {t("assignDriver")}
            <select
              className="h-8 flex-1 rounded-lg border border-border-strong bg-coal-850 px-2 text-sm text-cream-100"
              value={o.assignedDriverId ?? ""}
              onChange={(e) =>
                start(async () => {
                  await assignDriverAction({
                    orderId: o.id,
                    driverId: e.target.value || null,
                  });
                  await onChanged();
                })
              }
            >
              <option value="">{t("noDriver")}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

      {cancelling ? (
        <div className="flex flex-col gap-2 rounded-lg border border-chili-400/40 bg-chili-900/40 p-2">
          <p className="text-xs font-semibold text-chili-400">
            {t("cancelReason")}
          </p>
          {(locale === "ar" ? CANCEL_REASONS_AR : CANCEL_REASONS_EN).map(
            (r) => (
              <button
                key={r}
                type="button"
                disabled={pending}
                onClick={() => advance("cancelled", r)}
                className="rounded-md bg-coal-850 px-2 py-1.5 text-start text-xs hover:bg-coal-700"
              >
                {r}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setCancelling(false)}
            className="text-xs text-smoke-300"
          >
            {t("cancel")} ✕
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {next.map((s) => (
            <Button
              key={s}
              size="sm"
              className="flex-1"
              disabled={
                pending ||
                (o.status === "pending_payment" && o.paymentStatus !== "paid")
              }
              onClick={() => advance(s)}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t(`advance.${s}` as "advance.preparing")}
            </Button>
          ))}
          {!driverOnly && (
            <>
              <Button size="icon-sm" variant="secondary" asChild>
                <a
                  href={`${locale === "en" ? "/en" : ""}/admin/orders/${o.id}/ticket`}
                  target="_blank"
                  rel="noopener"
                  aria-label={t("print")}
                >
                  <Printer aria-hidden />
                </a>
              </Button>
              {o.status !== "delivered" && (
                <Button
                  size="icon-sm"
                  variant="danger"
                  aria-label={t("cancel")}
                  onClick={() => setCancelling(true)}
                >
                  <X aria-hidden />
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {o.status === "pending_payment" && (
        <p className="text-[0.7rem] text-smoke-400">{ts("pending_payment")}</p>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2">
      <p className="text-[0.7rem] text-smoke-400">{label}</p>
      <p className="tabular text-base font-semibold">{value}</p>
    </div>
  );
}

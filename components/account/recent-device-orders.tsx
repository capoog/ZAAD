"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RESTAURANT_TZ } from "@/lib/hours";
import { getRecentOrders, type RecentOrder } from "@/lib/recent-orders";

export function RecentDeviceOrders() {
  const t = useTranslations("account");
  const locale = useLocale();
  const [list, setList] = useState<RecentOrder[]>([]);
  useEffect(() => setList(getRecentOrders()), []);
  if (!list.length) return null;
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;
  return (
    <section className="mx-auto mt-8 w-full max-w-md">
      <h2 className="mb-3 font-sans text-base font-semibold">{t("recentOnDevice")}</h2>
      <ul className="flex flex-col gap-2">
        {list.map((o) => (
          <li key={o.token}>
            <Link href={`/orders/${o.token}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-border-strong">
              <ReceiptText className="size-5 text-ember-400" aria-hidden />
              <span className="flex-1">
                <span className="font-semibold">#{o.number}</span>
                <span className="ms-2 text-xs text-smoke-400">
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: RESTAURANT_TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(o.placedAt))}
                </span>
              </span>
              <span className="text-sm text-ember-300">{t("view")}</span>
              <Chevron className="size-4 text-ember-300" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

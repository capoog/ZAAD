import "server-only";
import { getDbHandle } from "../db";
import { cairoDayStart } from "./admin";

export interface Analytics {
  days: number;
  totals: { salesPiasters: number; orders: number; aovPiasters: number; delivered: number };
  previous: { salesPiasters: number; orders: number };
  daily: { day: string; salesPiasters: number; orders: number }[];
  topItems: { nameAr: string; nameEn: string; qty: number; revenuePiasters: number }[];
  byHour: { hour: number; orders: number }[];
  byArea: { nameAr: string; nameEn: string; orders: number; salesPiasters: number }[];
  byPayment: { method: string; orders: number; salesPiasters: number }[];
}

// Revenue counts every order that reached the kitchen (not cancelled, not unpaid online).
const COUNTED = `o.status not in ('cancelled', 'pending_payment')`;
const TZ = "Africa/Cairo";

export async function getAnalytics(days: number): Promise<Analytics> {
  const h = await getDbHandle();
  const end = new Date();
  const start = new Date(cairoDayStart(end).getTime() - (days - 1) * 86_400_000);
  const prevStart = new Date(start.getTime() - days * 86_400_000);
  const range = [start.toISOString(), end.toISOString()];

  const [totals] = await h.query<{ sales: number; n: number; delivered: number }>(
    `select coalesce(sum(total_piasters),0)::int sales, count(*)::int n,
            count(*) filter (where status = 'delivered')::int delivered
     from public.orders o where ${COUNTED} and placed_at >= $1 and placed_at <= $2`,
    range,
  );
  const [prev] = await h.query<{ sales: number; n: number }>(
    `select coalesce(sum(total_piasters),0)::int sales, count(*)::int n
     from public.orders o where ${COUNTED} and placed_at >= $1 and placed_at < $2`,
    [prevStart.toISOString(), start.toISOString()],
  );
  const daily = await h.query<{ day: string; sales: number; n: number }>(
    `with d as (
       select generate_series(($1::timestamptz at time zone '${TZ}')::date, ($2::timestamptz at time zone '${TZ}')::date, interval '1 day')::date as day
     )
     select to_char(d.day, 'YYYY-MM-DD') as day,
            coalesce(sum(o.total_piasters), 0)::int as sales,
            count(o.id)::int as n
     from d left join public.orders o
       on (o.placed_at at time zone '${TZ}')::date = d.day and ${COUNTED}
     group by d.day order by d.day`,
    range,
  );
  const top = await h.query<{ name_ar: string; name_en: string; qty: number; revenue: number }>(
    `select oi.name_ar, oi.name_en, sum(oi.quantity)::int qty, sum(oi.line_total_piasters)::int revenue
     from public.order_items oi join public.orders o on o.id = oi.order_id
     where ${COUNTED} and o.placed_at >= $1 and o.placed_at <= $2
     group by oi.name_ar, oi.name_en order by qty desc, revenue desc limit 8`,
    range,
  );
  const byHour = await h.query<{ hour: number; n: number }>(
    `select extract(hour from o.placed_at at time zone '${TZ}')::int as hour, count(*)::int n
     from public.orders o where ${COUNTED} and o.placed_at >= $1 and o.placed_at <= $2
     group by 1 order by 1`,
    range,
  );
  const byArea = await h.query<{ name_ar: string | null; name_en: string | null; n: number; sales: number }>(
    `select z.name_ar, z.name_en, count(*)::int n, coalesce(sum(o.total_piasters),0)::int sales
     from public.orders o left join public.delivery_zones z on z.id = o.zone_id
     where ${COUNTED} and o.placed_at >= $1 and o.placed_at <= $2
     group by z.name_ar, z.name_en order by n desc`,
    range,
  );
  const byPayment = await h.query<{ method: string; n: number; sales: number }>(
    `select o.payment_method::text as method, count(*)::int n, coalesce(sum(o.total_piasters),0)::int sales
     from public.orders o where ${COUNTED} and o.placed_at >= $1 and o.placed_at <= $2
     group by 1 order by n desc`,
    range,
  );

  const hours = new Map(byHour.map((r) => [Number(r.hour), Number(r.n)]));
  const n = Number(totals?.n ?? 0);
  const sales = Number(totals?.sales ?? 0);
  return {
    days,
    totals: { salesPiasters: sales, orders: n, aovPiasters: n ? Math.round(sales / n) : 0, delivered: Number(totals?.delivered ?? 0) },
    previous: { salesPiasters: Number(prev?.sales ?? 0), orders: Number(prev?.n ?? 0) },
    daily: daily.map((d) => ({ day: d.day, salesPiasters: Number(d.sales), orders: Number(d.n) })),
    topItems: top.map((t) => ({ nameAr: t.name_ar, nameEn: t.name_en, qty: Number(t.qty), revenuePiasters: Number(t.revenue) })),
    // Business day runs 12:00 → 02:00, so show hours in that order.
    byHour: [...Array.from({ length: 12 }, (_, i) => i + 12), 0, 1, 2].map((hour) => ({ hour, orders: hours.get(hour) ?? 0 })),
    byArea: byArea.map((a) => ({ nameAr: a.name_ar ?? "استلام من الفرع", nameEn: a.name_en ?? "Pickup", orders: Number(a.n), salesPiasters: Number(a.sales) })),
    byPayment: byPayment.map((p) => ({ method: p.method, orders: Number(p.n), salesPiasters: Number(p.sales) })),
  };
}


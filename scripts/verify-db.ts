/**
 * Verifies a freshly migrated + seeded database:
 *   1. the Drizzle mirror (server/db/schema.ts) matches the real columns
 *   2. Row Level Security behaves as designed for anon / customer / staff
 *   3. seed invariants (15 orders, totals, status history)
 *
 *   npm run db:verify            (in-memory PGlite)
 *   DATABASE_URL=… npm run db:verify
 */
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { createDbHandle, migrate, type DbHandle } from "../server/db/core";
import * as schema from "../server/db/schema";
import { seed } from "../server/db/seed/seed";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

/** Run queries as a given Postgres role + JWT claims, exactly like Supabase's PostgREST does. */
async function asRole<T>(
  h: DbHandle,
  role: "anon" | "authenticated",
  sub: string | null,
  sql: string,
): Promise<{ rows: T[]; error: string | null }> {
  const claims = JSON.stringify(sub ? { sub, role } : { role });
  try {
    await h.execScript(`begin; select set_config('request.jwt.claims', '${claims}', true); set local role ${role};`);
    const rows = await h.query<T>(sql);
    await h.execScript("rollback;");
    return { rows, error: null };
  } catch (err) {
    await h.execScript("rollback;").catch(() => {});
    return { rows: [], error: (err as Error).message };
  }
}

async function main() {
  const h = await createDbHandle({
    databaseUrl: process.env.DATABASE_URL || undefined,
    pgliteDataDir: process.env.DATABASE_URL ? undefined : "memory://",
  });
  console.log(`verifying on ${h.kind}`);
  await migrate(h);
  const seeded = (await h.query<{ n: number }>("select count(*)::int n from public.categories"))[0]?.n ?? 0;
  if (!seeded) await seed(h);

  // ── 1. Drizzle mirror vs database ───────────────────────────────────────
  console.log("schema mirror");
  const tables = (Object.values(schema) as unknown[]).filter(
    (v): v is PgTable => typeof v === "object" && v !== null && Symbol.for("drizzle:IsDrizzleTable") in v,
  );
  for (const t of tables) {
    const cfg = getTableConfig(t);
    const sch = cfg.schema ?? "public";
    if (sch === "auth") continue; // provided by Supabase / shim
    const dbCols = new Set(
      (
        await h.query<{ column_name: string }>(
          `select column_name from information_schema.columns where table_schema = $1 and table_name = $2`,
          [sch, cfg.name],
        )
      ).map((r) => r.column_name),
    );
    const mirror = new Set(cfg.columns.map((c) => c.name));
    const missingInDb = [...mirror].filter((c) => !dbCols.has(c));
    const missingInMirror = [...dbCols].filter((c) => !mirror.has(c));
    check(`${cfg.name} columns match`, missingInDb.length === 0 && missingInMirror.length === 0, {
      missingInDb,
      missingInMirror,
    });
  }

  const rlsOff = await h.query<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
  );
  check("RLS enabled on every public table", rlsOff.length === 0, rlsOff.map((r) => r.relname));

  // ── 2. RLS behaviour ────────────────────────────────────────────────────
  console.log("row level security");
  const ids = async (email: string) =>
    (await h.query<{ id: string }>(`select id from public.profiles where email = $1`, [email]))[0]?.id ?? null;
  const kitchen = await ids("kitchen@fahmzaatar.test");
  const manager = await ids("manager@fahmzaatar.test");
  const driver = await ids("driver@fahmzaatar.test");
  const customer =
    (await h.query<{ id: string }>(`select id from public.profiles where phone = '01012345678'`))[0]?.id ?? null;
  const strangerOrder = (
    await h.query<{ id: string }>(`select id from public.orders where user_id is null limit 1`)
  )[0]?.id;

  const anonMenu = await asRole<{ n: number }>(h, "anon", null, "select count(*)::int n from public.menu_items");
  check("anon reads the menu", (anonMenu.rows[0]?.n ?? 0) === 21, anonMenu);
  const anonOrders = await asRole<{ n: number }>(h, "anon", null, "select count(*)::int n from public.orders");
  check("anon sees no orders", anonOrders.rows[0]?.n === 0, anonOrders);
  const anonPromos = await asRole<{ n: number }>(h, "anon", null, "select count(*)::int n from public.promo_codes");
  check("anon cannot list promo codes", anonPromos.rows[0]?.n === 0, anonPromos);
  const anonSettings = await asRole<{ key: string }>(h, "anon", null, "select key from public.settings order by key");
  check(
    "anon reads only public settings",
    !anonSettings.rows.some((r) => r.key === "notifications") && anonSettings.rows.length === 5,
    anonSettings.rows,
  );
  const anonInsert = await asRole(
    h,
    "anon",
    null,
    `insert into public.orders (customer_name, customer_phone, fulfillment_type, subtotal_piasters, total_piasters)
     values ('x', '01011111111', 'pickup', 0, 0)`,
  );
  check("anon cannot insert orders", anonInsert.error !== null);

  const custOrders = await asRole<{ user_id: string | null }>(
    h,
    "authenticated",
    customer,
    "select user_id from public.orders",
  );
  check(
    "customer sees only own orders",
    custOrders.rows.length > 0 && custOrders.rows.every((r) => r.user_id === customer),
    { count: custOrders.rows.length },
  );
  const custOther = await asRole<{ n: number }>(
    h,
    "authenticated",
    customer,
    `select count(*)::int n from public.order_items where order_id = '${strangerOrder}'`,
  );
  check("customer cannot read another order's items", custOther.rows[0]?.n === 0, custOther);
  const custUpdate = await asRole<{ id: string }>(
    h,
    "authenticated",
    customer,
    `update public.orders set total_piasters = 1 where user_id = '${customer}' returning id`,
  );
  check("customer cannot change order totals", custUpdate.rows.length === 0 || custUpdate.error !== null, custUpdate);
  const custPay = await asRole<{ id: string }>(
    h,
    "authenticated",
    customer,
    `update public.payments set status = 'paid' returning id`,
  );
  check("customer cannot mark payments paid", custPay.rows.length === 0 || custPay.error !== null, custPay);
  const custRoles = await asRole(
    h,
    "authenticated",
    customer,
    `insert into public.user_roles (user_id, role_key) values ('${customer}', 'owner')`,
  );
  check("customer cannot grant themselves a role", custRoles.error !== null);

  const kitchenOrders = await asRole<{ n: number }>(h, "authenticated", kitchen, "select count(*)::int n from public.orders");
  check("kitchen sees all orders", kitchenOrders.rows[0]?.n === 15, kitchenOrders);
  const kitchenPromos = await asRole<{ n: number }>(
    h,
    "authenticated",
    kitchen,
    "select count(*)::int n from public.promo_codes",
  );
  check("kitchen cannot list promo codes", kitchenPromos.rows[0]?.n === 0, kitchenPromos);
  const kitchenMenu = await asRole<{ id: string }>(
    h,
    "authenticated",
    kitchen,
    "update public.menu_items set base_price_piasters = 1 returning id",
  );
  check("kitchen cannot change prices", kitchenMenu.rows.length === 0 || kitchenMenu.error !== null, kitchenMenu);
  const driverOrders = await asRole<{ n: number }>(h, "authenticated", driver, "select count(*)::int n from public.orders");
  check("driver sees only assigned orders", driverOrders.rows[0]?.n === 1, driverOrders);
  const managerPromos = await asRole<{ code: string }>(h, "authenticated", manager, "select code from public.promo_codes");
  check("manager manages promo codes", managerPromos.rows.some((r) => r.code === "WELCOME10"), managerPromos);
  const managerNotify = await asRole<{ n: number }>(
    h,
    "authenticated",
    manager,
    "select count(*)::int n from public.notification_log",
  );
  check("manager reads notification log", managerNotify.error === null, managerNotify);
  const rate = await asRole<{ n: number }>(h, "authenticated", manager, "select count(*)::int n from public.rate_limits");
  check("rate_limits invisible to clients", rate.rows[0]?.n === 0, rate);

  // ── 3. Seed invariants ──────────────────────────────────────────────────
  console.log("seed invariants");
  const [orders] = await h.query<{ n: number; active: number; pending: number }>(
    `select count(*)::int n,
            count(*) filter (where status in ('received','preparing','out_for_delivery','ready_for_pickup'))::int active,
            count(*) filter (where payment_status = 'pending_review')::int pending
     from public.orders`,
  );
  check("15 sample orders", orders?.n === 15, orders);
  check("3 live orders for the kitchen board", orders?.active === 3, orders);
  check("1 InstaPay transfer awaiting review", orders?.pending === 1, orders);
  const [mismatch] = await h.query<{ n: number }>(
    `select count(*)::int n from public.orders o
     where o.subtotal_piasters <> (select coalesce(sum(line_total_piasters), 0) from public.order_items where order_id = o.id)`,
  );
  check("order subtotals equal the sum of their lines", mismatch?.n === 0, mismatch);
  const [hist] = await h.query<{ n: number }>(
    `select count(*)::int n from public.orders o where not exists (select 1 from public.order_status_history where order_id = o.id)`,
  );
  check("every order has status history", hist?.n === 0, hist);
  const [kofta] = await h.query<{ name: string; prices: string }>(
    `select m.name_ar name, string_agg((s.price_piasters / 100)::text, ',' order by s.sort_order) prices
     from public.menu_items m join public.item_sizes s on s.menu_item_id = m.id where m.slug = 'grilled-kofta' group by 1`,
  );
  check("kofta sizes 220 / 420", kofta?.prices === "220,420", kofta);
  const [zones] = await h.query<{ n: number }>(`select count(*)::int n from public.delivery_zones`);
  check("5 delivery zones", zones?.n === 5, zones);

  await h.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed ✓");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

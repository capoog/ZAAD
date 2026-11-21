import "server-only";
import { sql } from "drizzle-orm";
import { env } from "../env";
import { createDbHandle, isSeeded, migrate, type Db, type DbHandle } from "./core";

export type { Db } from "./core";

declare global {
  // One handle per server process (survives Next dev hot reloads).
  var __fzDb: Promise<DbHandle> | undefined;
}

async function init(): Promise<DbHandle> {
  const e = env();
  const h = await createDbHandle({ databaseUrl: e.DATABASE_URL || undefined, pgliteDataDir: e.PGLITE_DATA_DIR });
  // The local database configures itself on first use. Remote databases are
  // migrated explicitly with `npm run db:setup` (never on a request path).
  if (h.kind === "pglite") {
    await migrate(h, (m) => console.log(`[db] ${m}`));
    if (e.AUTO_SEED === "true" && !(await isSeeded(h))) {
      console.log("[db] seeding local database…");
      const { seed } = await import("./seed/seed");
      await seed(h, { log: (m) => console.log(`[db] seed: ${m}`) });
    }
  }
  return h;
}

export function getDbHandle(): Promise<DbHandle> {
  if (!globalThis.__fzDb) {
    globalThis.__fzDb = init().catch((err) => {
      globalThis.__fzDb = undefined;
      throw err;
    });
  }
  return globalThis.__fzDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Run work in a transaction with an acting user recorded for audit triggers
 * (order_status_history.changed_by).
 */
export async function withActor<T>(actorId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (actorId) await tx.execute(sql`select set_config('app.actor_id', ${actorId}, true)`);
    return fn(tx);
  });
}

/**
 * Run reads exactly as Supabase's REST layer would for this user: as the
 * `authenticated` role with JWT claims set, so Row Level Security applies.
 */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

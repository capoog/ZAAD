/**
 * Database driver selection + migrations. Framework-agnostic (used by the Next
 * app through ./index.ts and by CLI scripts directly).
 *
 *   DATABASE_URL set   → node-postgres (Supabase or any Postgres)
 *   DATABASE_URL empty → embedded PGlite (real Postgres compiled to WASM),
 *                        persisted in PGLITE_DATA_DIR ("memory://" for tests)
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  kind: "pglite" | "postgres";
  db: Db;
  /** Run a multi-statement SQL script (no parameters). */
  execScript(sql: string): Promise<void>;
  /** Run a parameterised query and return rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export interface DbOptions {
  databaseUrl?: string | undefined;
  pgliteDataDir?: string | undefined;
}

export async function createDbHandle(opts: DbOptions): Promise<DbHandle> {
  if (opts.databaseUrl) {
    const pool = new pg.Pool({
      connectionString: opts.databaseUrl,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      // Supabase requires TLS; local Postgres usually doesn't.
      ssl: /supabase\.(co|com)/.test(opts.databaseUrl) ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzlePg(pool, { schema }) as unknown as Db;
    return {
      kind: "postgres",
      db,
      async execScript(sqlText) {
        const client = await pool.connect();
        try {
          await client.query(sqlText);
        } catch (err) {
          // Never hand an aborted transaction back to the pool.
          await client.query("rollback").catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      async query(sqlText, params = []) {
        const res = await pool.query(sqlText, params as unknown[]);
        return res.rows as never[];
      },
      async close() {
        await pool.end();
      },
    };
  }

  const dataDir = opts.pgliteDataDir ?? ".data/pglite";
  if (!dataDir.startsWith("memory://")) fs.mkdirSync(path.resolve(dataDir), { recursive: true });
  const client = new PGlite(dataDir.startsWith("memory://") ? undefined : path.resolve(dataDir));
  await client.waitReady;
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return {
    kind: "pglite",
    db,
    async execScript(sqlText) {
      await client.exec(sqlText);
    },
    async query(sqlText, params = []) {
      const res = await client.query(sqlText, params as unknown[]);
      return res.rows as never[];
    },
    async close() {
      await client.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------
const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const LOCAL_SHIM_DIR = path.join(ROOT, "supabase", "local");

function sqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** True when the target database is a Supabase project (auth schema managed by Supabase). */
async function hasSupabaseAuth(h: DbHandle): Promise<boolean> {
  const rows = await h.query<{ exists: boolean }>(
    `select exists (select 1 from information_schema.tables
       where table_schema = 'auth' and table_name = 'identities') as exists`,
  );
  return Boolean(rows[0]?.exists);
}

export async function migrate(h: DbHandle, log: (msg: string) => void = () => {}): Promise<string[]> {
  await h.execScript(`
    create schema if not exists app_meta;
    create table if not exists app_meta.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const applied = new Set(
    (await h.query<{ name: string }>(`select name from app_meta.schema_migrations`)).map((r) => r.name),
  );

  const files: { name: string; file: string }[] = [];
  if (!(await hasSupabaseAuth(h))) {
    for (const f of sqlFiles(LOCAL_SHIM_DIR)) files.push({ name: `local/${f}`, file: path.join(LOCAL_SHIM_DIR, f) });
  }
  for (const f of sqlFiles(MIGRATIONS_DIR)) files.push({ name: f, file: path.join(MIGRATIONS_DIR, f) });

  const ran: string[] = [];
  for (const { name, file } of files) {
    if (applied.has(name)) continue;
    log(`→ applying ${name}`);
    const body = fs.readFileSync(file, "utf8");
    try {
      await h.execScript(
        `begin;\n${body}\n;insert into app_meta.schema_migrations (name) values ('${name.replace(/'/g, "''")}');\ncommit;`,
      );
    } catch (err) {
      await h.execScript("rollback;").catch(() => {});
      throw new Error(`Migration ${name} failed: ${(err as Error).message}`);
    }
    ran.push(name);
  }
  return ran;
}

export async function isSeeded(h: DbHandle): Promise<boolean> {
  const rows = await h.query<{ n: number }>(`select count(*)::int as n from public.categories`);
  return (rows[0]?.n ?? 0) > 0;
}

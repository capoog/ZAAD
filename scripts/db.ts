/**
 * Database CLI.
 *   npm run db:migrate   apply supabase/migrations (+ local auth shim when not on Supabase)
 *   npm run db:seed      seed menu, zones, settings, staff and 15 sample orders (empty DB only)
 *   npm run db:reset     PGlite only: wipe the local database, migrate and seed
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDbHandle, isSeeded, migrate } from "../server/db/core";
import { seed } from "../server/db/seed/seed";

async function main() {
  const cmd = process.argv[2] ?? "setup";
  const databaseUrl = process.env.DATABASE_URL || undefined;
  const pgliteDataDir = process.env.PGLITE_DATA_DIR || ".data/pglite";

  if (cmd === "reset") {
    if (databaseUrl) throw new Error("db:reset only works on the local PGlite database. Reset Supabase from its dashboard.");
    if (!pgliteDataDir.startsWith("memory://")) fs.rmSync(path.resolve(pgliteDataDir), { recursive: true, force: true });
    console.log(`wiped ${pgliteDataDir}`);
  }

  const h = await createDbHandle({ databaseUrl, pgliteDataDir });
  console.log(`database: ${h.kind}${h.kind === "pglite" ? ` (${pgliteDataDir})` : ""}`);
  try {
    const ran = await migrate(h, (m) => console.log(m));
    console.log(ran.length ? `applied ${ran.length} migration(s)` : "migrations up to date");
    if (cmd === "migrate") return;

    if (await isSeeded(h)) {
      console.log("already seeded — skipping (use db:reset for a fresh local database)");
      return;
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAdmin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
    await seed(h, { supabaseAdmin, log: (m) => console.log(`seed: ${m}`) });
    console.log("seeded ✓");
  } finally {
    await h.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * Fixed-window rate limiter backed by Postgres, so it works across serverless
 * instances (an in-memory counter would reset per Vercel lambda).
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; remaining: number }> {
  const db = await getDb();
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const res = await db.execute(sql`
    insert into public.rate_limits (bucket, window_start, hits)
    values (${bucket}, ${windowStart.toISOString()}, 1)
    on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
    returning hits
  `);
  // Both drivers (node-postgres, PGlite) return { rows }.
  const hits = Number((res as unknown as { rows: { hits: number }[] }).rows[0]?.hits ?? 0);
  // Opportunistic cleanup of old windows.
  if (Math.random() < 0.02) {
    await db.execute(sql`delete from public.rate_limits where window_start < now() - interval '1 day'`);
  }
  return { ok: hits <= limit, remaining: Math.max(0, limit - hits) };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "local";
}

import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, getDbHandle } from "../db";
import * as s from "../db/schema";
import { env } from "../env";

const CODE_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;

function hashCode(phone: string, code: string): string {
  return createHmac("sha256", env().AUTH_SECRET ?? "fz-local-otp").update(`${phone}:${code}`).digest("hex");
}

/** Local mock OTP: stores a hashed code; the "SMS" is the server log (and the demo UI). */
export async function issueLocalOtp(phone: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const h = await getDbHandle();
  await h.query(
    `insert into auth.local_otp_codes (phone, code_hash, expires_at) values ($1, $2, now() + interval '${CODE_TTL_MIN} minutes')`,
    [phone, hashCode(phone, code)],
  );
  console.log(`[otp:mock] code for ${phone}: ${code}`);
  return code;
}

export async function verifyLocalOtp(phone: string, code: string): Promise<boolean> {
  const h = await getDbHandle();
  const rows = await h.query<{ id: number; code_hash: string; attempts: number }>(
    `select id, code_hash, attempts from auth.local_otp_codes
     where phone = $1 and consumed_at is null and expires_at > now()
     order by created_at desc limit 1`,
    [phone],
  );
  const row = rows[0];
  if (!row || row.attempts >= MAX_ATTEMPTS) return false;
  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(phone, code), "hex");
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  await h.query(
    ok
      ? `update auth.local_otp_codes set consumed_at = now() where id = $1`
      : `update auth.local_otp_codes set attempts = attempts + 1 where id = $1`,
    [row.id],
  );
  return ok;
}

/** Find (or create) the local auth user for a verified phone number. */
export async function upsertPhoneUser(phone: string, fullName?: string): Promise<string> {
  const db = await getDb();
  const [existing] = await db.select({ id: s.authUsers.id }).from(s.authUsers).where(eq(s.authUsers.phone, phone)).limit(1);
  if (existing) {
    await db.update(s.authUsers).set({ lastSignInAt: new Date() }).where(eq(s.authUsers.id, existing.id));
    return existing.id;
  }
  const [created] = await db
    .insert(s.authUsers)
    .values({ phone, rawUserMetaData: fullName ? { full_name: fullName } : {}, lastSignInAt: new Date() })
    .returning({ id: s.authUsers.id });
  if (!created) throw new Error("could not create user");
  return created.id;
}


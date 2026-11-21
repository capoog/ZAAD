"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeEgyptianPhone, toE164, EG_MOBILE_REGEX } from "@/lib/phone";
import { getDb } from "../db";
import * as s from "../db/schema";
import { env, isSupabaseConfigured } from "../env";
import { issueLocalOtp, upsertPhoneUser, verifyLocalOtp } from "../auth/otp";
import { verifyPassword } from "../auth/password";
import { clearSession, createLocalSession, getSession, supabaseServer } from "../auth/session";
import { clientIp, rateLimit } from "../security/rate-limit";
import { claimGuestOrders } from "../services/orders";

export type AuthResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: "INVALID_PHONE" | "RATE_LIMITED" | "INVALID_CODE" | "INVALID_CREDENTIALS" | "NOT_STAFF" | "SEND_FAILED" };

const phoneSchema = z.string().transform(normalizeEgyptianPhone).refine((p) => EG_MOBILE_REGEX.test(p));

export async function requestOtpAction(raw: unknown): Promise<AuthResult> {
  const parsed = phoneSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID_PHONE" };
  const phone = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`otp:phone:${phone}`, 3, 600)).ok || !(await rateLimit(`otp:ip:${ip}`, 10, 3600)).ok) {
    return { ok: false, error: "RATE_LIMITED" };
  }
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithOtp({ phone: toE164(phone) });
    return error ? { ok: false, error: "SEND_FAILED" } : { ok: true };
  }
  const code = await issueLocalOtp(phone);
  // Demo mode: there is no SMS provider, so the code is shown in the UI.
  return { ok: true, devCode: env().OTP_PROVIDER === "mock" ? code : undefined };
}

export async function verifyOtpAction(raw: unknown): Promise<AuthResult> {
  const parsed = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/), name: z.string().max(80).optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID_CODE" };
  const { phone, code, name } = parsed.data;
  if (!(await rateLimit(`otp-verify:${phone}`, 8, 600)).ok) return { ok: false, error: "RATE_LIMITED" };

  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.verifyOtp({ phone: toE164(phone), token: code, type: "sms" });
    if (error || !data.user) return { ok: false, error: "INVALID_CODE" };
    await claimGuestOrders(data.user.id, phone);
    return { ok: true };
  }
  if (!(await verifyLocalOtp(phone, code))) return { ok: false, error: "INVALID_CODE" };
  const userId = await upsertPhoneUser(phone, name?.trim() || undefined);
  const db = await getDb();
  if (name?.trim()) await db.update(s.profiles).set({ fullName: name.trim() }).where(eq(s.profiles.id, userId));
  await createLocalSession(userId);
  await claimGuestOrders(userId, phone);
  return { ok: true };
}

export async function staffLoginAction(raw: unknown): Promise<AuthResult> {
  const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID_CREDENTIALS" };
  const email = parsed.data.email.toLowerCase();
  if (!(await rateLimit(`login:${await clientIp()}`, 10, 600)).ok) return { ok: false, error: "RATE_LIMITED" };

  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) return { ok: false, error: "INVALID_CREDENTIALS" };
  } else {
    const db = await getDb();
    const [user] = await db.select().from(s.authUsers).where(eq(s.authUsers.email, email)).limit(1);
    if (!user || !(await verifyPassword(parsed.data.password, user.encryptedPassword))) {
      return { ok: false, error: "INVALID_CREDENTIALS" };
    }
    await createLocalSession(user.id);
  }
  const session = await getSession.call(null);
  if (!session || session.roles.length === 0) {
    // getSession is request-cached and may not see the new cookie yet; check roles directly.
    const db = await getDb();
    const [u] = await db.select({ id: s.profiles.id }).from(s.profiles).where(eq(s.profiles.email, email)).limit(1);
    const roles = u ? await db.select().from(s.userRoles).where(eq(s.userRoles.userId, u.id)) : [];
    if (roles.length === 0) {
      await clearSession();
      return { ok: false, error: "NOT_STAFF" };
    }
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await clearSession();
}

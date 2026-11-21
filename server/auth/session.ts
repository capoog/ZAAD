import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { getDb } from "../db";
import * as s from "../db/schema";
import { env, isSupabaseConfigured } from "../env";

export type StaffRole = s.StaffRole;

export interface Session {
  userId: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  roles: StaffRole[];
}

export const SESSION_COOKIE = "fz_session";
const SESSION_DAYS = 30;

// ── Local (non-Supabase) session: signed JWT in an httpOnly cookie ──────────
let devSecret: Uint8Array | undefined;
function localSecret(): Uint8Array {
  const configured = env().AUTH_SECRET;
  if (configured) return new TextEncoder().encode(configured);
  if (env().NODE_ENV === "production" && env().DATABASE_URL) {
    throw new Error("AUTH_SECRET must be set in production when Supabase Auth is not configured.");
  }
  if (!devSecret) {
    // Stable per local install so sessions survive restarts.
    const file = path.resolve(".data", "auth-secret");
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, randomBytes(48).toString("base64url"), { mode: 0o600 });
    }
    devSecret = new TextEncoder().encode(fs.readFileSync(file, "utf8").trim());
  }
  return devSecret;
}

export async function createLocalSession(userId: string): Promise<void> {
  const token = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(localSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

async function localUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, localSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ── Supabase session ────────────────────────────────────────────────────────
export async function supabaseServer() {
  const e = env();
  const jar = await cookies();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* called from a Server Component: cookies are read-only there */
        }
      },
    },
  });
}

async function supabaseUserId(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** The signed-in user (customer or staff) for this request, or null. */
export const getSession = cache(async (): Promise<Session | null> => {
  const userId = isSupabaseConfigured() ? await supabaseUserId() : await localUserId();
  if (!userId) return null;
  const db = await getDb();
  const [profile] = await db.select().from(s.profiles).where(eq(s.profiles.id, userId)).limit(1);
  if (!profile) return null;
  const roles = await db.select({ role: s.userRoles.roleKey }).from(s.userRoles).where(eq(s.userRoles.userId, userId));
  return {
    userId,
    phone: profile.phone,
    email: profile.email,
    fullName: profile.fullName,
    roles: roles.map((r) => r.role),
  };
});

export async function clearSession(): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  (await cookies()).delete(SESSION_COOKIE);
}

export function hasAnyRole(session: Session | null, roles: StaffRole[]): boolean {
  return Boolean(session?.roles.some((r) => roles.includes(r)));
}

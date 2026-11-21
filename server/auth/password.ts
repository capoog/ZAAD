import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/** scrypt password hashing for the local auth provider (Supabase hashes its own). */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");
  const key = await scrypt(password, salt);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "../env";

export type Bucket = "menu-images" | "payment-proofs";

/** Supabase Storage when configured; otherwise files on local disk under .data/uploads. */
export interface Storage {
  put(bucket: Bucket, key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  read(bucket: Bucket, key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  /** URL usable in <img>. Public bucket → public URL, private → app route that checks permissions. */
  url(bucket: Bucket, key: string): string;
}

const LOCAL_ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(".data", "uploads"));
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", heic: "image/heic", svg: "image/svg+xml" };

function safeKey(key: string): string {
  if (!/^[a-zA-Z0-9/_.-]{1,200}$/.test(key) || key.includes("..")) throw new Error("bad storage key");
  return key;
}

const local: Storage = {
  async put(bucket, key, bytes) {
    const file = path.join(LOCAL_ROOT, bucket, safeKey(key));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  },
  async read(bucket, key) {
    try {
      const file = path.join(LOCAL_ROOT, bucket, safeKey(key));
      const bytes = await fs.readFile(file);
      return { bytes, contentType: TYPES[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  },
  url(bucket, key) {
    return `/api/files/${bucket}/${key}`;
  },
};

function supabaseStorage(): Storage {
  const e = env();
  const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return {
    async put(bucket, key, bytes, contentType) {
      const { error } = await admin.storage.from(bucket).upload(safeKey(key), bytes, { contentType, upsert: true });
      if (error) throw error;
    },
    async read(bucket, key) {
      const { data, error } = await admin.storage.from(bucket).download(safeKey(key));
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
    },
    url(bucket, key) {
      return bucket === "menu-images"
        ? `${e.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`
        : `/api/files/${bucket}/${key}`;
    },
  };
}

export function storage(): Storage {
  return isSupabaseConfigured() ? supabaseStorage() : local;
}

/** Sniff the real file type from magic bytes (never trust the client's MIME type). */
export function sniffImage(bytes: Uint8Array): { ext: string; type: string } | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand.startsWith("avi")) return { ext: "avif", type: "image/avif" };
    if (["heic", "heix", "mif1", "msf1", "hevc"].includes(brand)) return { ext: "heic", type: "image/heic" };
  }
  return null;
}

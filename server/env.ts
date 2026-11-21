import { z } from "zod";

/**
 * Server-side environment, validated once. Everything is optional so the demo
 * runs with zero configuration (embedded PGlite + mock providers).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SITE_URL: z.string().url().default("http://localhost:3000"),

  // Database: a Postgres URL (Supabase pooler or any Postgres). Empty = embedded PGlite.
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default(".data/pglite"),
  AUTO_SEED: z.enum(["true", "false"]).default("true"),

  // Supabase (Auth, Storage, Realtime). Empty = local implementations.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Local session signing (only used without Supabase).
  AUTH_SECRET: z.string().min(32).optional(),

  // Payments
  PAYMENT_MODE: z.enum(["mock", "sandbox", "live"]).default("mock"),
  PAYMOB_SECRET_KEY: z.string().optional(),
  PAYMOB_PUBLIC_KEY: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
  PAYMOB_INTEGRATION_CARD: z.string().optional(),
  PAYMOB_INTEGRATION_WALLET: z.string().optional(),
  PAYMOB_INTEGRATION_FAWRY: z.string().optional(),
  PAYMOB_INTEGRATION_VALU: z.string().optional(),

  // Notifications
  WHATSAPP_PROVIDER: z.enum(["mock", "cloud_api"]).default("mock"),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  RESTAURANT_ALERT_PHONE: z.string().default("01000000000"),

  // Phone OTP for the local auth provider (mock prints the code).
  OTP_PROVIDER: z.enum(["mock"]).default("mock"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function isSupabaseConfigured(e: ServerEnv = env()): boolean {
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY);
}

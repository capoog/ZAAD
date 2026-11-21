import "server-only";
import { getDb } from "../db";
import * as s from "../db/schema";
import { env } from "../env";
import { toE164 } from "@/lib/phone";

/**
 * WhatsApp notifications behind a provider interface.
 *   mock      → written to notification_log (status "mocked") + server log
 *   cloud_api → Meta WhatsApp Cloud API (text message; production needs approved templates)
 */
export interface WhatsAppProvider {
  name: string;
  send(to: string, body: string): Promise<{ ok: boolean; error?: string }>;
}

const mockProvider: WhatsAppProvider = {
  name: "mock",
  async send(to, body) {
    console.log(`[whatsapp:mock] → ${to}\n${body}\n`);
    return { ok: true };
  },
};

const cloudApiProvider: WhatsAppProvider = {
  name: "cloud_api",
  async send(to, body) {
    const e = env();
    const res = await fetch(`https://graph.facebook.com/v21.0/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toE164(to).slice(1), type: "text", text: { body } }),
      signal: AbortSignal.timeout(8000),
    }).catch((err: Error) => ({ ok: false, statusText: err.message }) as Response);
    return res.ok ? { ok: true } : { ok: false, error: res.statusText || "send failed" };
  },
};

export function whatsapp(): WhatsAppProvider {
  return env().WHATSAPP_PROVIDER === "cloud_api" ? cloudApiProvider : mockProvider;
}

export async function sendWhatsApp(opts: {
  orderId: string | null;
  audience: "customer" | "restaurant";
  to: string;
  template: string;
  body: string;
}): Promise<void> {
  const provider = whatsapp();
  const db = await getDb();
  let status: "sent" | "mocked" | "failed" = provider.name === "mock" ? "mocked" : "sent";
  let error: string | null = null;
  try {
    const r = await provider.send(opts.to, opts.body);
    if (!r.ok) {
      status = "failed";
      error = r.error ?? "unknown";
    }
  } catch (err) {
    status = "failed";
    error = (err as Error).message;
  }
  await db.insert(s.notificationLog).values({
    orderId: opts.orderId,
    channel: "whatsapp",
    audience: opts.audience,
    recipient: opts.to,
    template: opts.template,
    body: opts.body,
    provider: provider.name,
    status,
    error,
  });
}

import "server-only";
import { EventEmitter } from "node:events";
import { env, isSupabaseConfigured } from "../env";

/**
 * Realtime fan-out. Payloads are deliberately tiny ("something changed");
 * clients re-fetch through authorised server code, so nothing sensitive is
 * broadcast.
 *   Supabase  → Realtime Broadcast (REST), private topic for staff
 *   Local     → in-process emitter consumed by the SSE route (/api/realtime)
 */
export type Topic = `order:${string}` | "staff:orders";
export interface RealtimeEvent {
  type: "order.created" | "order.updated" | "payment.updated";
  orderId?: string;
  status?: string;
  at: string;
}

declare global {
  var __fzBus: EventEmitter | undefined;
}

export function localBus(): EventEmitter {
  if (!globalThis.__fzBus) {
    globalThis.__fzBus = new EventEmitter();
    globalThis.__fzBus.setMaxListeners(500);
  }
  return globalThis.__fzBus;
}

export async function publish(topic: Topic, event: Omit<RealtimeEvent, "at">): Promise<void> {
  const payload: RealtimeEvent = { ...event, at: new Date().toISOString() };
  localBus().emit(topic, payload);
  if (!isSupabaseConfigured()) return;
  const e = env();
  try {
    await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: e.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic, event: payload.type, payload, private: topic === "staff:orders" }],
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.warn("[realtime] broadcast failed", (err as Error).message);
  }
}

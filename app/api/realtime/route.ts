import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getSession, hasAnyRole } from "@/server/auth/session";
import { getDb } from "@/server/db";
import * as s from "@/server/db/schema";
import { localBus, type RealtimeEvent, type Topic } from "@/server/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events for the local (non-Supabase) realtime implementation. */
export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get("topic") ?? "";
  if (topic === "staff:orders") {
    if (!hasAnyRole(await getSession(), ["owner", "manager", "kitchen", "driver"])) return new Response("forbidden", { status: 403 });
  } else if (/^order:[a-f0-9]{32}$/.test(topic)) {
    const db = await getDb();
    const [o] = await db.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.trackingToken, topic.slice(6))).limit(1);
    if (!o) return new Response("not found", { status: 404 });
  } else {
    return new Response("bad topic", { status: 400 });
  }

  const bus = localBus();
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));
      send(`retry: 3000\n\n`);
      const onEvent = (e: RealtimeEvent) => send(`event: message\ndata: ${JSON.stringify(e)}\n\n`);
      bus.on(topic as Topic, onEvent);
      const ping = setInterval(() => send(`: ping\n\n`), 25_000);
      cleanup = () => {
        clearInterval(ping);
        bus.off(topic as Topic, onEvent);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

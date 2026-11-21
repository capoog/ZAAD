"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

let sbClient: ReturnType<typeof createBrowserClient> | null = null;
function supabaseBrowser() {
  if (!sbClient) sbClient = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return sbClient;
}

/**
 * Subscribe to a realtime topic ("order:<token>" or "staff:orders").
 * Supabase Realtime Broadcast when configured, otherwise the SSE endpoint.
 * A slow poll runs underneath so a dropped connection never leaves stale UI.
 */
export function useRealtime(topic: string | null, onEvent: (payload: unknown) => void, pollMs = 30_000) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!topic) return;
    const fire = (p: unknown) => handler.current(p);
    const poll = window.setInterval(() => fire({ type: "poll" }), pollMs);
    let cleanup = () => {};
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const sb = supabaseBrowser();
      const channel = sb
        .channel(topic, { config: { private: topic === "staff:orders" } })
        .on("broadcast", { event: "*" }, (msg: { payload?: unknown }) => fire(msg.payload))
        .subscribe();
      cleanup = () => void sb.removeChannel(channel);
    } else {
      const es = new EventSource(`/api/realtime?topic=${encodeURIComponent(topic)}`);
      es.onmessage = (e) => {
        try {
          fire(JSON.parse(e.data));
        } catch {
          fire({});
        }
      };
      cleanup = () => es.close();
    }
    const onVisible = () => document.visibilityState === "visible" && fire({ type: "visible" });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      cleanup();
    };
  }, [topic, pollMs]);
}

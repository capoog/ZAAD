"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PromoRule } from "./pricing";

export interface CartLine {
  key: string;
  menuItemId: string;
  slug: string;
  sizeId: string | null;
  addonIds: string[];
  quantity: number;
  notes: string;
}

export type FulfillmentChoice = "delivery" | "pickup";

interface CartState {
  lines: CartLine[];
  fulfillment: FulfillmentChoice;
  zoneId: string | null;
  promo: PromoRule | null;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setFulfillment: (f: FulfillmentChoice) => void;
  setZone: (zoneId: string | null) => void;
  setPromo: (promo: PromoRule | null) => void;
}

export const lineKey = (l: Pick<CartLine, "menuItemId" | "sizeId" | "addonIds" | "notes">) =>
  [l.menuItemId, l.sizeId ?? "-", [...l.addonIds].sort().join("+") || "-", l.notes.trim()].join("|");

/**
 * The cart only stores *what* was chosen. Prices are always re-derived from
 * the live menu (and recalculated again on the server at checkout).
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      fulfillment: "delivery",
      zoneId: null,
      promo: null,
      add: (line) =>
        set((st) => {
          const key = lineKey(line);
          const existing = st.lines.find((l) => l.key === key);
          if (existing) {
            return {
              lines: st.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l)),
            };
          }
          return { lines: [...st.lines, { ...line, key }].slice(-40) };
        }),
      setQuantity: (key, quantity) =>
        set((st) => ({
          lines:
            quantity <= 0
              ? st.lines.filter((l) => l.key !== key)
              : st.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l)),
        })),
      remove: (key) => set((st) => ({ lines: st.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [], promo: null }),
      setFulfillment: (fulfillment) => set({ fulfillment }),
      setZone: (zoneId) => set({ zoneId }),
      setPromo: (promo) => set({ promo }),
    }),
    {
      name: "fz-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** True once the persisted cart has been read from localStorage (avoids hydration mismatch). */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useCart.persist.hasHydrated()) setHydrated(true);
    return useCart.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

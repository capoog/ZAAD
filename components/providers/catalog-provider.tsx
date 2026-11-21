"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { priceOrder, type PricingResult } from "@/lib/pricing";
import { useCart, useCartHydrated, type CartLine } from "@/lib/cart-store";
import type { MenuCategory, MenuItem, PublicSettings, Zone } from "@/types/catalog";

interface CatalogValue {
  menu: MenuCategory[];
  itemsById: Map<string, MenuItem>;
  itemsBySlug: Map<string, MenuItem>;
  zones: Zone[];
  settings: PublicSettings;
}

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({
  menu,
  zones,
  settings,
  children,
}: {
  menu: MenuCategory[];
  zones: Zone[];
  settings: PublicSettings;
  children: ReactNode;
}) {
  const value = useMemo<CatalogValue>(() => {
    const items = menu.flatMap((c) => c.items);
    return {
      menu,
      zones,
      settings,
      itemsById: new Map(items.map((i) => [i.id, i])),
      itemsBySlug: new Map(items.map((i) => [i.slug, i])),
    };
  }, [menu, zones, settings]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const v = useContext(CatalogContext);
  if (!v) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return v;
}

export interface CartView {
  hydrated: boolean;
  lines: (CartLine & { item: MenuItem })[];
  count: number;
  pricing: PricingResult;
  zone: Zone | null;
}

/** Live cart totals computed from the current menu prices. */
export function useCartView(): CartView {
  const hydrated = useCartHydrated();
  const { itemsById, zones, settings } = useCatalog();
  const lines = useCart((s) => s.lines);
  const fulfillment = useCart((s) => s.fulfillment);
  const zoneId = useCart((s) => s.zoneId);
  const promo = useCart((s) => s.promo);

  return useMemo(() => {
    const valid = hydrated
      ? lines.filter((l) => itemsById.has(l.menuItemId)).map((l) => ({ ...l, item: itemsById.get(l.menuItemId)! }))
      : [];
    const zone = zones.find((z) => z.id === zoneId) ?? null;
    const pricing = priceOrder({
      lines: valid,
      items: itemsById,
      fulfillment,
      zone: fulfillment === "delivery" && zone ? zone : null,
      promo,
      vat: settings.vat,
    });
    return { hydrated, lines: valid, count: valid.reduce((n, l) => n + l.quantity, 0), pricing, zone };
  }, [hydrated, lines, itemsById, zones, zoneId, fulfillment, promo, settings.vat]);
}

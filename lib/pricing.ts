/**
 * Pure pricing engine. The server loads prices from the database and calls
 * this; the client may call it too for instant UI feedback, but the server
 * result is the only one ever stored or charged.
 */
import type { Piasters } from "./money";

export interface PricingAddon {
  id: string;
  nameAr: string;
  nameEn: string;
  pricePiasters: Piasters;
  isAvailable: boolean;
}

export interface PricingAddonGroup {
  id: string;
  nameAr: string;
  nameEn: string;
  minSelect: number;
  maxSelect: number | null;
  addons: PricingAddon[];
}

export interface PricingSize {
  id: string;
  nameAr: string;
  nameEn: string;
  pricePiasters: Piasters;
  isDefault: boolean;
}

export interface PricingMenuItem {
  id: string;
  nameAr: string;
  nameEn: string;
  basePricePiasters: Piasters;
  isActive: boolean;
  isSoldOut: boolean;
  sizes: PricingSize[];
  addonGroups: PricingAddonGroup[];
}

export interface CartLineInput {
  menuItemId: string;
  sizeId?: string | null;
  addonIds?: string[];
  quantity: number;
  notes?: string | null;
}

export interface PromoRule {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  /** percent: whole percent; fixed: piasters */
  discountValue: number;
  maxDiscountPiasters: Piasters | null;
  minSubtotalPiasters: Piasters;
}

export interface VatRule {
  rateBps: number; // 1400 = 14%
  pricesIncludeVat: boolean;
}

export interface ZoneRule {
  id: string;
  feePiasters: Piasters;
  minOrderPiasters: Piasters;
}

export interface PricedAddon {
  id: string;
  nameAr: string;
  nameEn: string;
  pricePiasters: Piasters;
}

export interface PricedLine {
  menuItemId: string;
  sizeId: string | null;
  nameAr: string;
  nameEn: string;
  sizeNameAr: string | null;
  sizeNameEn: string | null;
  unitPricePiasters: Piasters;
  addonsUnitPiasters: Piasters;
  quantity: number;
  lineTotalPiasters: Piasters;
  addons: PricedAddon[];
  notes: string | null;
}

export type PricingErrorCode =
  | "EMPTY_CART"
  | "ITEM_NOT_FOUND"
  | "ITEM_UNAVAILABLE"
  | "SIZE_REQUIRED"
  | "SIZE_NOT_FOUND"
  | "ADDON_NOT_FOUND"
  | "ADDON_UNAVAILABLE"
  | "ADDON_GROUP_MIN"
  | "ADDON_GROUP_MAX"
  | "BAD_QUANTITY"
  | "TOO_MANY_ITEMS"
  | "ZONE_REQUIRED"
  | "BELOW_MIN_ORDER"
  | "PROMO_MIN_SUBTOTAL";

export interface PricingError {
  code: PricingErrorCode;
  lineIndex?: number;
  meta?: Record<string, string | number>;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalPiasters: Piasters;
  discountPiasters: Piasters;
  deliveryFeePiasters: Piasters;
  vatPiasters: Piasters;
  totalPiasters: Piasters;
  vatRateBps: number;
  pricesIncludeVat: boolean;
  promo: PromoRule | null;
  errors: PricingError[];
}

export const MAX_QTY_PER_LINE = 50;
export const MAX_LINES = 40;

export function priceLine(
  input: CartLineInput,
  item: PricingMenuItem | undefined,
  lineIndex: number,
): { line: PricedLine | null; errors: PricingError[] } {
  const errors: PricingError[] = [];
  if (!item) return { line: null, errors: [{ code: "ITEM_NOT_FOUND", lineIndex }] };
  if (!item.isActive || item.isSoldOut) errors.push({ code: "ITEM_UNAVAILABLE", lineIndex });
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QTY_PER_LINE) {
    errors.push({ code: "BAD_QUANTITY", lineIndex });
  }

  let unit = item.basePricePiasters;
  let sizeId: string | null = null;
  let sizeNameAr: string | null = null;
  let sizeNameEn: string | null = null;
  if (item.sizes.length > 0) {
    const size = input.sizeId ? item.sizes.find((s) => s.id === input.sizeId) : undefined;
    if (!input.sizeId) errors.push({ code: "SIZE_REQUIRED", lineIndex });
    else if (!size) errors.push({ code: "SIZE_NOT_FOUND", lineIndex });
    if (size) {
      unit = size.pricePiasters;
      sizeId = size.id;
      sizeNameAr = size.nameAr;
      sizeNameEn = size.nameEn;
    }
  }

  const requested = [...new Set(input.addonIds ?? [])];
  const addons: PricedAddon[] = [];
  for (const addonId of requested) {
    const group = item.addonGroups.find((g) => g.addons.some((a) => a.id === addonId));
    const addon = group?.addons.find((a) => a.id === addonId);
    if (!addon) {
      errors.push({ code: "ADDON_NOT_FOUND", lineIndex });
      continue;
    }
    if (!addon.isAvailable) errors.push({ code: "ADDON_UNAVAILABLE", lineIndex });
    addons.push({ id: addon.id, nameAr: addon.nameAr, nameEn: addon.nameEn, pricePiasters: addon.pricePiasters });
  }
  for (const group of item.addonGroups) {
    const picked = group.addons.filter((a) => requested.includes(a.id)).length;
    if (picked < group.minSelect) errors.push({ code: "ADDON_GROUP_MIN", lineIndex, meta: { group: group.id } });
    if (group.maxSelect !== null && picked > group.maxSelect) {
      errors.push({ code: "ADDON_GROUP_MAX", lineIndex, meta: { group: group.id } });
    }
  }

  const addonsUnit = addons.reduce((sum, a) => sum + a.pricePiasters, 0);
  const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.trunc(input.quantity) || 1));
  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 200) : null;
  return {
    line: {
      menuItemId: item.id,
      sizeId,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      sizeNameAr,
      sizeNameEn,
      unitPricePiasters: unit,
      addonsUnitPiasters: addonsUnit,
      quantity: qty,
      lineTotalPiasters: (unit + addonsUnit) * qty,
      addons,
      notes,
    },
    errors,
  };
}

export function computeDiscount(subtotal: Piasters, promo: PromoRule | null): Piasters {
  if (!promo || subtotal < promo.minSubtotalPiasters) return 0;
  let d =
    promo.discountType === "percent" ? Math.floor((subtotal * promo.discountValue) / 100) : promo.discountValue;
  if (promo.maxDiscountPiasters !== null) d = Math.min(d, promo.maxDiscountPiasters);
  return Math.max(0, Math.min(d, subtotal));
}

/**
 * VAT is charged on what the customer pays for food + delivery after discounts.
 * Inclusive prices: VAT is the tax portion already inside the price.
 * Exclusive prices: VAT is added on top.
 */
export function computeVat(taxable: Piasters, vat: VatRule): Piasters {
  if (vat.rateBps <= 0 || taxable <= 0) return 0;
  return vat.pricesIncludeVat
    ? Math.round((taxable * vat.rateBps) / (10000 + vat.rateBps))
    : Math.round((taxable * vat.rateBps) / 10000);
}

export function priceOrder(params: {
  lines: CartLineInput[];
  items: ReadonlyMap<string, PricingMenuItem>;
  fulfillment: "delivery" | "pickup";
  zone: ZoneRule | null;
  promo: PromoRule | null;
  vat: VatRule;
}): PricingResult {
  const errors: PricingError[] = [];
  const lines: PricedLine[] = [];

  if (params.lines.length === 0) errors.push({ code: "EMPTY_CART" });
  if (params.lines.length > MAX_LINES) errors.push({ code: "TOO_MANY_ITEMS" });

  params.lines.slice(0, MAX_LINES).forEach((input, i) => {
    const r = priceLine(input, params.items.get(input.menuItemId), i);
    errors.push(...r.errors);
    if (r.line) lines.push(r.line);
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotalPiasters, 0);

  let deliveryFee = 0;
  if (params.fulfillment === "delivery") {
    if (!params.zone) errors.push({ code: "ZONE_REQUIRED" });
    else {
      deliveryFee = params.zone.feePiasters;
      if (subtotal < params.zone.minOrderPiasters) {
        errors.push({ code: "BELOW_MIN_ORDER", meta: { min: params.zone.minOrderPiasters } });
      }
    }
  }

  let promo = params.promo;
  if (promo && subtotal < promo.minSubtotalPiasters) {
    errors.push({ code: "PROMO_MIN_SUBTOTAL", meta: { min: promo.minSubtotalPiasters } });
    promo = null;
  }
  const discount = computeDiscount(subtotal, promo);
  const taxable = subtotal - discount + deliveryFee;
  const vatAmount = computeVat(taxable, params.vat);
  const total = taxable + (params.vat.pricesIncludeVat ? 0 : vatAmount);

  return {
    lines,
    subtotalPiasters: subtotal,
    discountPiasters: discount,
    deliveryFeePiasters: deliveryFee,
    vatPiasters: vatAmount,
    totalPiasters: total,
    vatRateBps: params.vat.rateBps,
    pricesIncludeVat: params.vat.pricesIncludeVat,
    promo,
    errors,
  };
}
